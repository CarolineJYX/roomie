"""One explicitly invoked official GPT Image 2 edit probe. No automatic retries."""
import argparse
import base64
import hashlib
import io
import json
import os
import time
import warnings
from pathlib import Path

import requests
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
MODEL = "gpt-image-2"
PROMPT = """请以随请求上传的宿舍合照为唯一人物参考，生成一张完整的竖版多格中文漫画。
保留两位人物的脸型、五官、眼镜、发型与服装：一位穿粉色连帽衫、戴黑框眼镜；另一位穿红色外套、扎双辫子。细腻现代日系漫画风，适度美化但不改变年龄和身体比例。不得用重复裁切照片代替不同场景的绘制。
这是虚构宿舍示例，用于测试接口。情节：报到中午一起吃黄焖鸡米饭；红衣女生主动帮不太会铺床的粉衣女生铺床；两人收拾宿舍；辅导员拍合照；毕业四年后回忆当天。不要另加事件或人物对白。
输出一张1024×1536的PNG竖版漫画，五格，自上而下阅读。白色页边、深色分镜边框，构图有宽窄变化，中文字体清楚，文字不遮脸。
顶部标题必须写：报到第一天的合影
第一格为较宽横格：大学校门口饭店，两人面对面吃饭，桌上两份黄焖鸡米饭。旁白：大学报到的中午，我们在校门口吃了黄焖鸡米饭。
第二格：宿舍里两人一起铺床，红衣女生整理床单，粉衣女生在旁协助。旁白：我不太会铺床，是她主动来帮我。
第三格：整理床单的双手特写，与上一格衔接，不重复整幅画。旁白：动作很快，也很稳。
第四格：两人站在已收拾好的宿舍中，展示房间和人物互动。旁白：用半天时间把宿舍收拾到这个样子，对我们来说真像个小奇迹。
第五格为较大结尾格：辅导员从画面边缘举手机拍摄，两位女生并肩站在床铺之间，姿势与原合照呼应。旁白：那天下午，辅导员为我们按下合影的快门。转眼，我们已经毕业4年了。
只绘制指定标题和五条旁白，不增加对话气泡、品牌、额外标识或水印。原照片保持为人物参考，不原样贴入漫画；人物跨格一致，眼镜不消失，手部自然。"""


class ProbeError(Exception):
    pass


def prepare_image():
    raw = (ROOT / "assets/dorm-original-photo.png").read_bytes()
    with Image.open(io.BytesIO(raw)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        image.thumbnail((1536, 1536))
        clean = Image.new("RGB", image.size)
        clean.paste(image)
        output = io.BytesIO()
        clean.save(output, "PNG")
    return output.getvalue()


def run_probe(output_dir, client_factory=requests.Session):
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise ProbeError("未读取到 OPENAI_API_KEY。请在设置密钥的同一个终端运行。")
    reference = prepare_image()
    output_dir.mkdir(mode=0o700, parents=False, exist_ok=True)
    marker = output_dir / "attempt.json"
    report = {"model": MODEL, "endpoint": "https://api.openai.com/v1/images/edits",
              "size": "1024x1536", "quality": "medium", "n": 1,
              "reference": "dorm-original-photo.png", "prompt_sha256": hashlib.sha256(PROMPT.encode()).hexdigest(),
              "status": "started", "started_at": time.time()}
    try:
        with marker.open("x", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
    except FileExistsError:
        raise ProbeError("本目录已有一次测试记录，未再次调用。请先查看 attempt.json，超时请求也可能已计费。") from None
    (output_dir / "prompt.txt").write_text(PROMPT, encoding="utf-8")
    started = time.monotonic()
    try:
        with client_factory() as client:
            client.trust_env = False
            response = client.post(
                report["endpoint"], headers={"Authorization": "Bearer " + key},
                files={"image": ("reference.png", reference, "image/png")},
                data={"model": MODEL, "prompt": PROMPT, "size": "1024x1536", "quality": "medium", "n": "1", "output_format": "png"},
                timeout=(15, 300), allow_redirects=False,
            )
        report["http_status"] = response.status_code
        if response.status_code != 200:
            hints = {401: "密钥无效或已过期。", 403: "请检查模型权限或组织验证状态。", 404: "当前项目无法访问该模型或接口。", 429: "请检查余额、额度或速率限制。", 400: "请求参数被拒绝，需要核对参数或账户限制。"}
            raise ProbeError(f"OpenAI 返回 HTTP {response.status_code}。" + hints.get(response.status_code, "上游请求失败。") + "未自动重试。")
        data = response.json()
        items = data.get("data")
        if not isinstance(items, list) or len(items) != 1:
            raise ProbeError("接口未返回预期的一张图片。未自动重试。")
        encoded = items[0].get("b64_json")
        if not isinstance(encoded, str) or len(encoded) > 40 * 1024 * 1024:
            raise ProbeError("返回图片数据缺失或过大。")
        image_bytes = base64.b64decode(encoded, validate=True)
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(image_bytes)) as generated:
                generated.load()
                if generated.format != "PNG" or generated.size != (1024, 1536):
                    raise ProbeError("返回图片的格式或尺寸与请求不一致。")
        (output_dir / "comic.png").write_bytes(image_bytes)
        usage = data.get("usage") or {}
        report.update(status="succeeded", image="comic.png", bytes=len(image_bytes),
                      usage={k: usage.get(k) for k in ("input_tokens", "output_tokens", "total_tokens")})
    except requests.Timeout:
        report.update(status="uncertain", error="请求超时，上游可能已经生成并计费。未自动重试。")
    except ProbeError as error:
        report.update(status="failed", error=str(error))
    except Exception:
        report.update(status="uncertain", error="网络或响应处理异常，上游可能已经计费。未打印原始响应，未自动重试。")
    finally:
        report["seconds"] = round(time.monotonic() - started, 2)
        marker.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="单次GPT Image 2官方接口测试：宿舍示例、中等质量、只生成一张。")
    parser.add_argument("--confirm-one-image", action="store_true", help="确认本次会产生一次生图API请求，可能计费")
    args = parser.parse_args()
    if not args.confirm_one_image:
        raise SystemExit("请加 --confirm-one-image 明确执行一次付费图片测试。")
    try:
        result = run_probe(ROOT / "image2-probe")
    except ProbeError as error:
        raise SystemExit(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("测试记录目录：", ROOT / "image2-probe")
    if result["status"] != "succeeded":
        raise SystemExit(1)

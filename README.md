# Roomie

一个面向年轻合租群体的治愈系生活协作工具，支持 AA 账单、小屋任务、公共物品和室友公约。完成共同事务还可以照顾公益小室友「绒米 Rumi」，积攒暖心毛线并体验公益项目选择。

当前 Demo 使用昵称创建独立的 24 小时服务端会话，业务数据由 Python 标准库 API 与 SQLite 保存。重新登录会生成全新的演示数据，普通刷新会保留当前进度。

## 在线体验

http://43.130.7.180

## 自动部署

推送到 `main` 分支后，GitHub Actions 会同步静态页面和 `server/` API，安装 systemd 服务并更新 Nginx。仓库需要配置以下 Actions Secrets：

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`

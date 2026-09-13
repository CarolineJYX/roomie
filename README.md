# Roomie

一个面向年轻合租群体的治愈系生活协作工具，支持 AA 账单、小屋任务、公共物品和室友公约。完成共同事务还可以照顾公益小室友「绒米 Rumi」，积攒暖心毛线并体验公益项目选择。

## 在线体验

http://43.130.7.180

## 自动部署

推送到 `main` 分支后，GitHub Actions 会将 `dist/` 同步到部署服务器。仓库需要配置以下 Actions Secrets：

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`

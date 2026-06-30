# Skills 云部署注意事项

远程安装、本地 ZIP 安装和从 Skills.sh 安装的 Skill 都会写入后端配置的 Skills 目录。默认情况下，如果没有配置 `SKILLS_DIR`，后端会使用当前工作目录下的 `skills/` 目录；本地开发时通常会表现为 `backend-ts/skills` 或 `apps/api/skills`。

生产环境不要依赖代码目录作为 Skill 安装目录。建议显式配置独立、可写、可持久化的数据目录：

```env
SKILLS_DIR=/var/lib/mosaic-dock/skills
```

Docker 或 Kubernetes 部署时，建议将该目录挂载到持久化卷：

```env
SKILLS_DIR=/data/mosaic-dock/skills
```

## 部署场景

- 单台云服务器：可行。确保 `SKILLS_DIR` 对运行后端的系统用户可写，并纳入备份。
- Docker 容器：必须挂载 volume。否则容器重建、升级或迁移后，运行时安装的 Skill 会丢失。
- Kubernetes：建议使用 PVC 挂载 `SKILLS_DIR`。如果有多副本，需要考虑共享存储和并发写入控制。
- 多实例部署：不建议各实例写各自本地目录。应使用共享文件系统、统一分发机制，或将安装操作限制到单个管理实例。
- Serverless 或只读镜像：不适合当前文件系统安装方案。运行时写入本地文件通常不可持久化，也可能不可写。

## 安装后的加载行为

安装接口会在写入完成后触发一次扫描，使新 Skill 在当前运行实例中生效。服务重启后，后端会重新扫描 `SKILLS_DIR`，只要目录是持久化的，已安装的 Skill 会继续可用。

## 生产建议

- 明确配置 `SKILLS_DIR`，不要使用默认目录。
- 给目录设置最小必要写权限，避免后端进程拥有过大的文件系统权限。
- 对 `SKILLS_DIR` 做备份或快照，尤其是允许用户上传或远程安装 Skill 的环境。
- 多实例场景下为安装、卸载、更新操作加锁，避免多个实例同时修改同一 Skill。
- 将系统内置 Skill 与用户安装 Skill 分开管理，减少升级应用镜像时误删运行时数据的风险。

# SignalLab · 信号与系统交互学习（Beta）

以奥本海姆《信号与系统》的知识体系为参考，提供原创中文讲解、数学实验、习题与复习工具。适用于本科课程学习与复习，并非教材全文或官方配套产品。

[打开学习网站](https://lml99me.github.io/signals-and-systems-lab/) · [反馈问题 / 数学纠错](https://github.com/lml99me/signals-and-systems-lab/issues/new?template=bug_report.yml) · [Beta 测试说明](BETA.md)

## 可以做什么

- 学习信号基础、系统性质、LTI、傅里叶分析、采样、拉普拉斯变换与 Z 变换。
- 用六个预设实验室观察波形变换、时不变性、卷积、傅里叶合成、混叠及极点零点。
- 在自定义工作区输入 CT/DT 表达式，观察普通函数、离散序列及连续冲激各自的数学行为。
- 完成原创习题、收藏知识点与题目、重做错题、查看公式与复习计划。
- 在当前浏览器本地保存进度，手动导出或导入学习记录。

## 打开与离线使用

直接访问上方网站链接。项目使用原生 HTML、CSS、JavaScript 和随目录附带的 KaTeX，无需登录、安装依赖或启动应用服务器。

如需离线学习，下载仓库的完整 ZIP 并解压，保留目录结构，然后用浏览器打开 `index.html`。在线网址本身不保证在断网后首次打开；完整本地文件夹可离线运行。iPadOS 的“文件”快速预览可能不执行脚本，应使用支持本地网页的浏览器或阅读工具，或通过静态站点网址访问。

学习记录和自定义信号库使用当前浏览器的 `localStorage`。清理网站数据、隐私模式、切换设备或改变网址来源可能影响这些记录，建议定期手动备份。学习记录不会随仓库公开；提交 GitHub 反馈时，请自行检查公开内容。

## Beta 与数学边界

网站处于 Beta 阶段，欢迎反馈可复现的问题。连续时间冲激以独立的权重箭头表示，不把它当作有限高度的普通函数。自定义卷积与频谱明确显示数值窗口、网格和近似说明；有限窗计算不保证等于无限信号的完整变换。详见 [BETA.md](BETA.md)。

## GitHub Pages 部署

这是可直接托管的静态网站，不需要 Vite、npm 构建或数据库。

1. 仓库默认分支使用 `main`。
2. 仓库管理员在 **Settings → Pages → Build and deployment** 中，将 **Source** 设为 **GitHub Actions**。
3. 推送 `main` 会运行 `.github/workflows/pages.yml`；也可在 **Actions** 中手动运行该工作流。
4. 部署完成后，在工作流的 `github-pages` 环境链接中查看实际网址。

工作流只把 `index.html`、`css/`、`js/`、`assets/`、`vendor/` 和 `.nojekyll` 打包到 Pages；README、反馈配置与仓库管理文件不进入网站发布包。应用采用 `#` 路由，适用于 GitHub Pages 项目子路径。

## 目录

```text
index.html
css/        页面与信号工具样式
js/         课程、习题、实验及安全表达式引擎
assets/     网站图标等静态资源
vendor/     本地公式渲染库及其许可证
.github/    Pages 工作流和反馈表单
```

KaTeX 的 MIT 许可证保留在 [`vendor/katex/LICENSE`](vendor/katex/LICENSE)。课程讲解和题目为原创，公开参考资料见网站的项目说明。

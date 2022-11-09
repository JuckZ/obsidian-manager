# Obsidian Manager 插件

这是一个想要解决大多数人在obsidian使用过程中遇到的所有琐碎问题的插件工具包。

## 开始

[English Doc](./README.md)

## 为什么选择 Obsidian Manager

如果你只需要电脑端的通知消息，不需要手机端，那么你可以使用obsidian-reminder插件
如果你只想简单的将昨日未完成转移到今天的日记中，那么直接使用obsidian-rollover-daily-todos

但是我们的插件：

1. 与ntfy整合，不久后可以提供免费的ntfy服务，这会让你能在任何设备上收到来自obsidian的提醒，比如日程表提醒，生日提醒等
2. 可以支持更复杂的场景，比如支持templater中异步逻辑与转移todo的功能结合使用
3. 未来会增加更多功能

## 使用

## 开发路线

- [ ] demo.gif (showcase)
- [ ] image auto upload to aliyun oss and so on [Coming soon~]
- [ ] bigfile auto upload to aliyun oss and so on [Coming soon~]
- [ ] better spaced repetition
- [ ] random background (speed up) [Coming soon~]
- [ ] better notification (mobile and desktop)
  - [x] [ntfy](https://ntfy.sh/docs/) support [beta], with it you can get notification on every platform.
- [ ] Function switch
- [ ] better Journal
  - [x] todo list rollover added the option of automatic synchronization
  - [ ] Automatic statistics of daily time utilization
  - [ ] daily quote [Coming soon~]
  - [ ] random banner [Coming soon~]
  - [ ] random picture [Coming soon~]
  - [ ] others
- [ ] path converter. (for typora user who use relative path like "./xxx/xxx.ext" other than "xxx/xxx.ext" in Obsidian)
- [ ] attachment path convert to full relative path
- [ ] others

## 开发

1. 

## 调试

### Windows(cmd.exe)

```cmd
set "OUTDIR=path_to_this_plugin_in_your_obsidian_vault" && npm run dev
```

### Windows(Powershell)

```powershell
($env:OUTDIR = "path_to_this_plugin_in_your_obsidian_vault") -and (npm run dev)
```

eg.

```powershell
($env:OUTDIR="../juckz.github.io/blogs/.obsidian/plugins/obsidian-manager") -and (npm run dev)
```

### Linux, macOS(Bash)

```bash
OUTDIR="path_to_this_plugin_in_your_obsidian_vault" npm run dev
```

## 参考

1. obsidian-rollover-daily-todos 的所有代码 [obsidian-rollover-daily-todos](https://github.com/lumoe/obsidian-rollover-daily-todos)
2. obsidian-admotion 的项目结构 [obsidian-admotion](https://github.com/valentine195/obsidian-admonition)
3. obsidian-reminder 的部分代码 [obsidian-reminder](https://github.com/uphy/obsidian-reminder)

# Obsidian Manager Plugin

A Toolkit try to solve all the trivial problems most people usually encountered in obsidian.

## Getting started

[中文文档](./README_cn.md)

## Why Obsidian Manager

If you only need notification messages on the computer side, not on the mobile side, then you can use the obsidian-reminder plugin.
If you just want to simply transfer yesterday's unfinished work to today's diary, use obsidian-rollover-daily-todos directly.

But to our plugin:

1. Work with ntfy, and support free server in few weeks, you can receive reminders from obsidian on any device such as calendar reminder, birthday reminder, etc..
2. Can support more complex scenarios, such as supporting asynchronous logic in templater in conjunction with the ability to transfer todo
3. More functions will be added in the future.

## Usage

## Roadmap

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

## Develop

1. To use the CLI to set up a semantic release just run the following command inside your projects directory: `npx semantic-release-cli setup`

## Debug

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

## Reference

1. all codes of obsidian-rollover-daily-todos [obsidian-rollover-daily-todos](https://github.com/lumoe/obsidian-rollover-daily-todos)
2. obsidian-admotion structure [obsidian-admotion](https://github.com/valentine195/obsidian-admonition)
3. part of codes of obsidian-reminder [obsidian-reminder](https://github.com/uphy/obsidian-reminder)

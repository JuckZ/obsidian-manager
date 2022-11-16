# Obsidian Manager Plugin

<p align="center">
  <img width="300px" src="https://avatars.githubusercontent.com/u/65011256?s=280&v=4">
</p>

<p align="center">
  <a href="https://github.com/semantic-release/semantic-release">
    <img src="https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg">
  </a>
  <a href="https://npmcharts.com/compare/obsidian-manager?minimal=true">
    <img src="https://img.shields.io/npm/dm/obsidian-manager.svg">
  </a>
  <a href="https://codecov.io/gh/JuckZ/obsidian-manager" > 
    <img src="https://codecov.io/gh/JuckZ/obsidian-manager/branch/master/graph/badge.svg?token=D6DI2HRC5Q"/> 
  </a>
  <br>
</p>

<p align="center">
  <a href="https://www.npmjs.org/package/obsidian-manager">
    <img src="https://img.shields.io/npm/v/obsidian-manager/latest.svg">
  </a>
  <a href="https://www.npmjs.org/package/obsidian-manager">
    <img src="https://img.shields.io/npm/v/obsidian-manager/next.svg">
  </a>
  <a href="https://www.npmjs.org/package/obsidian-manager">
    <img src="https://img.shields.io/npm/v/obsidian-manager/beta.svg">
  </a>
</p>

<p align="center">Obsidian Manager Plugin - An Obsidian plugin library</p>

- 💪 Coverage testing based on Jest
- 🔥 Written in TypeScript

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
- [ ] colorful tag(Refer to the todo tree plugin of vscode)
- [ ] random background (speed up) [Coming soon~]
- [ ] image auto upload to aliyun oss and so on [Coming soon~]
- [ ] bigfile auto upload to aliyun oss and so on [Coming soon~]
- [ ] better spaced repetition
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
- [ ] More beautiful day planner
  - [ ] support preview doc in timeline
- [ ] others
  - [ ] auto update manifest.json
  - [ ] test v1
  - [ ] npm install error

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

## Test Report

<img src="https://codecov.io/gh/JuckZ/obsidian-manager/branch/master/graphs/sunburst.svg?token=D6DI2HRC5Q"/> 

## Reference

1. all codes of obsidian-rollover-daily-todos [obsidian-rollover-daily-todos](https://github.com/lumoe/obsidian-rollover-daily-todos)
2. obsidian-admotion structure [obsidian-admotion](https://github.com/valentine195/obsidian-admonition)
3. part of codes of obsidian-reminder [obsidian-reminder](https://github.com/uphy/obsidian-reminder)

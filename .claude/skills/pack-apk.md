---
name: pack-apk
description: 将 Vue 项目打包成 Android APK 安装包，默认打 release 包，可通过参数控制
triggers:
  - 打包
  - 打包APP
  - 打包apk
  - 打包APK
  - 打包app
  - 构建APK
  - 生成APK
  - 打包成app
  - 打包成apk
---

# 打包 APK 技能

将当前 Vue + Capacitor 项目构建并打包成 Android APK。**默认打 release 包**，通过参数可切换为 debug。

## 参数解析规则

从用户输入中解析构建类型：
- 用户提到 `debug`、`debug版本`、`测试包`、`调试版` → 构建 debug 版本
- 其他情况（无参数 / `release` / `正式包` / `发布`）→ 构建 release 版本（**默认**）

## 环境配置

系统默认 Java 1.8，需使用 Android Studio 自带的 JBR（Java 21）：

```bash
export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
```

## 执行步骤

### 1. 构建前端

```bash
npm run build 2>&1
```

超时 120 秒。构建失败则修复后重试。

### 2. 同步到 Capacitor

```bash
npx cap sync android 2>&1
```

### 3. 构建 APK

#### release 版本（默认）

先检查密钥文件是否存在。密钥文件路径：`android/app/ff-space.keystore`

如果密钥文件不存在，生成新密钥：
```bash
cd android/app && keytool -genkey -v -keystore ff-space.keystore -alias ff-space -keyalg RSA -keysize 2048 -validity 10000 -storepass ffspace123 -keypass ffspace123 -dname "CN=ff-space, OU=dev, O=sjl, L=Unknown, ST=Unknown, C=CN" 2>&1
```

然后构建：
```bash
cd android && ./gradlew assembleRelease 2>&1
```

构建完成后，APK 位置：
```
android/app/build/outputs/apk/release/app-release.apk
```

#### debug 版本（用户指定 debug 时）

```bash
cd android && ./gradlew assembleDebug 2>&1
```

构建完成后，APK 位置：
```
android/app/build/outputs/apk/debug/app-debug.apk
```

所有 Gradle 构建超时 600 秒。

### 4. 验证并报告结果

用 `ls -lh` 确认 APK 文件存在并输出大小。

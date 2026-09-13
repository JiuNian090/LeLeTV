-- 设备识别改造：区分「设备实例 ID」与「软指纹」
--
-- 背景：原先 devices.device_fingerprint 存的是软指纹（UA + 屏幕尺寸 + 时区 + 语言 + platform
-- 的哈希）。同型号同系统的设备（例如两台 iPad 11 / iPadOS 26）这五项完全一致，
-- 会算出同一个指纹，被服务端当成同一台设备，互相覆盖设备名与活跃时间。
--
-- 改造后：
--   device_fingerprint  -> 设备实例 ID（浏览器本地生成并持久化的随机 ID，d_ 前缀）
--   device_signature    -> 软指纹（含 canvas / WebGL 等高熵项），同型号设备间仍可能相同，
--                          仅用于「本机 ID 丢失（清缓存/无痕模式）」时找回自己的记录。
ALTER TABLE devices ADD COLUMN device_signature TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_devices_signature ON devices(device_signature);

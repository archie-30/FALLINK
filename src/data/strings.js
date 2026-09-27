export const STRINGS={
    'ui.rotate':'請旋轉裝置',
    'ui.dash':'衝刺',
    'quality.low':'低',
    'quality.mid':'中',
    'quality.high':'高',
    'debug.fps':'FPS',
    'debug.calls':'繪製呼叫',
    'debug.tris':'三角形',
    'debug.quality':'畫質',
    'debug.resolution':'解析度',
    'debug.hint':'F2 切換畫質 · F3 除錯資訊'
};

export function t(key) {
    return STRINGS[key]??key;
}

import { defineStore } from 'pinia';
import EventBus from '../../common/EventBus';
import { useIpcRenderer } from '../../common/Utils';
import { useThemeStore } from './themeStore';

const ipcRenderer = useIpcRenderer()

const QUALITIES = [{
    id: 'NQ',
    name: '普通'
}, {
    id: 'HQ',
    name: '高'
}, {
    id: 'SQ',
    name: '无损'
}]

//TODO 本地缓存导致Store State数据不一致
export const useSettingStore = defineStore('setting', {
    state: () => ({
        /* 主题 */
        theme: {
            index: 0,
            type: 0,
        },
        layout: {
            index: 0,
            fallbackIndex: 0
        },
        common: {
            winZoom: 100,
            fontFamily: '',
            fontWeight: 400,
        },
        /* 播放歌曲 */
        track: {
            //音质级别：NQ(普通)、HQ（高音质）、SQ（超高、无损）
            quality: {
                index: 0,
            },
            //VIP收费歌曲，是否自动切换到免费歌曲（可能来自不同平台），默认暂停播放
            vipTransfer: false,
            vipFlagShow: false,
            //歌单分类栏随机显示
            categoryBarRandom: false,
            listenNumShow: false,
            //播放歌曲时，防止系统睡眠
            playingWithoutSleeping: false,
        },
        /* 歌词 */
        lyric: {
            fontSize: 18,   //普通字号
            hlFontSize: 21, //高亮字号
            fontWeight: 400,
            lineHeight: 28,
            lineSpacing: 26,
            offset: 0, //时间补偿值，快慢
            metaPos: 0, //歌曲信息, 0:默认, 1:隐藏, 2:顶部
            alignment: 0, //对齐方式, 0:左, 1:中, 2:右
        },
        /* 缓存 */
        cache: {
            storePlayState: true,   //退出后保存播放状态：包括当前歌曲、播放列表等
            storeLocalMusic: false, //退出后记录已经添加的本地歌曲
            storeRecentPlay: true,  //记录最近播放
        },
        /* 菜单栏、系统托盘 */
        tray: {
            show: false, //是否在系统托盘显示
        },
        /* 导航栏 */
        navigation: {
            customPlaylistsShow: false,
            favoritePlaylistsShow: false,
            followArtistsShow: false,
        },
        /* 对话框 */
        dialog: {
            clearQueue: true,
            batchAdd: false,
            batchMove: true,
            batchDelete: true,
            restore: true,
            reset: true,
            quit: false,
        },
        /* 快捷键 */
        keys: {
            global: false, //是否全局（系统平台级别）快捷键
            data: [{
                id: 'togglePlay',
                name: '播放 / 暂停',
                binding: 'Space',
                gBinding: 'Shift + Space'
            }, {
                id: 'togglePlayMode',
                name: '切换播放模式',
                binding: 'M',
                gBinding: 'Shift + M'
            }, {
                id: 'playPrev',
                name: '上一曲',
                binding: 'Left',
                gBinding: 'Shift + Left'
            }, {
                id: 'playNext',
                name: '下一曲',
                binding: 'Right',
                gBinding: 'Shift + Right'
            }, {
                id: 'volumeUp',
                name: '增加音量',
                binding: 'Up',
                gBinding: 'Shift + Up'
            }, {
                id: 'volumeDown',
                name: '减小音量',
                binding: 'Down',
                gBinding: 'Shift + Down'
            }, {
                id: 'volumeMuteOrMax',
                name: '静音 / 最大音量',
                binding: 'O',
                gBinding: 'Shift + O'
            }, {
                id: 'toggleSetting',
                name: '打开设置',
                binding: 'P',
                gBinding: 'Shift + P'
            }, {
                id: 'togglePlaybackQueue',
                name: '打开 / 关闭当前播放',
                binding: 'Q',
                gBinding: 'Shift + Q'
            }, {
                id: 'toggleLyricToolbar',
                name: '打开 / 关闭歌词设置',
                binding: 'L',
                gBinding: 'Shift + L'
            }]
        },
        /* 网络 */
        network: {
            httpProxy: {
                enable: false,
                host: null,
                port: 80,
                username: null,
                password: null
            },
            socksProxy: {
                enable: false,
                host: null,
                port: 80,
                username: null,
                password: null
            }
        },
        /* 其他 */
        other: {

        },
        blackHole: null, //黑洞state，永远不需要持久化
    }),
    getters: {
        isPlaylistCategoryBarRandom(state) {
            return this.track.categoryBarRandom
        },
        isStorePlayStateBeforeQuit(state) {
            return this.cache.storePlayState
        },
        isStoreLocalMusicBeforeQuit(state) {
            return this.cache.storeLocalMusic
        },
        isStoreRecentPlay() {
            return this.cache.storeRecentPlay
        },
        isDefaultLayout() { //默认布局，目前包含2种
            const index = this.layout.index
            return index == 0 || index == 1
        },
        isDefaultClassicLayout() {
            const index = this.layout.index
            return index == 1
        },
        isSimpleLayout() {
            const index = this.layout.index
            return index == 2
        },
        getWindowZoom() {
            return this.common.winZoom
        },
        isListenNumShow() {
            return this.track.listenNumShow
        },
        lyricMetaPos() {
            return this.lyric.metaPos
        },
        isHttpProxyEnable() {
            return this.network.httpProxy.enable
        },
        isSocksProxyEnable() {
            return this.network.socksProxy.enable
        }
    },
    actions: {
        setThemeIndex(index, type) {
            this.theme.index = index || 0
            this.theme.type = type || 0
            //const themeId = THEMES[index].id
            //EventBus.emit("switchTheme", themeId)
        },
        setLayoutIndex(index) {
            this.layout.index = index || 0
            const currentIndex = this.layout.index
            if (currentIndex < 2) this.layout.fallbackIndex = currentIndex
            EventBus.emit("app-layout")
        },
        switchToFallbackLayout() {
            this.setLayoutIndex(this.layout.fallbackIndex)
            this.setupWindowZoom()
        },
        presetThemes() {
            const { getPresetThemes } = useThemeStore()
            return getPresetThemes()
        },
        getCurrentThemeId() {
            const { getTheme } = useThemeStore()
            const { type, index } = this.theme
            return getTheme(type, index).id
        },
        getCurrentThemeColor() {
            const { getTheme } = useThemeStore()
            const { type, index } = this.theme
            return getTheme(type, index).color
        },
        getCurrentThemeHlColor() {
            const { getTheme } = useThemeStore()
            const { type, index } = this.theme
            return getTheme(type, index).hlColor
        },
        setWindowZoom(value) {
            if (!value) return
            const zoom = Number(value || 100)
            if (zoom < 50 || zoom > 300) return
            if (this.common.winZoom == zoom) return
            this.common.winZoom = zoom
            this.setupWindowZoom()
        },
        setTrackQualityIndex(index) {
            this.track.quality.index = index
        },
        toggleVipTransfer() {
            this.track.vipTransfer = !this.track.vipTransfer
        },
        toggleCategoryBarRandom() {
            this.track.categoryBarRandom = !this.track.categoryBarRandom
        },
        togglePlayingWithoutSleeping() {
            this.track.playingWithoutSleeping = !this.track.playingWithoutSleeping
            this.setupAppSuspension()
        },
        toggleListenNumShow() {
            this.track.listenNumShow = !this.track.listenNumShow
        },
        toggleVipFlagShow() {
            this.track.vipFlagShow = !this.track.vipFlagShow
        },
        toggleTrayShow() {
            this.tray.show = !this.tray.show
            this.setupTray()
        },
        toggleCustomPlaylistsShow() {
            this.navigation.customPlaylistsShow = !this.navigation.customPlaylistsShow
        },
        toggleFavoritePlaylistsShow() {
            this.navigation.favoritePlaylistsShow = !this.navigation.favoritePlaylistsShow
        },
        toggleFollowArtistsShow() {
            this.navigation.followArtistsShow = !this.navigation.followArtistsShow
        },
        toggleKeysGlobal() {
            this.keys.global = !this.keys.global
            this.setupGlobalShortcut()
        },
        toggleStorePlayState() {
            this.cache.storePlayState = !this.cache.storePlayState
        },
        toggleStoreLocalMusic() {
            this.cache.storeLocalMusic = !this.cache.storeLocalMusic
        },
        toggleStoreRecentPlay() {
            this.cache.storeRecentPlay = !this.cache.storeRecentPlay
        },
        setupWindowZoom() {
            const zoom = this.common.winZoom
            if (ipcRenderer) ipcRenderer.send("app-zoom", zoom)
            EventBus.emit("app-zoom", zoom)
        },
        setupWindowZoomWithoutResize() {
            const zoom = this.common.winZoom
            if (ipcRenderer) ipcRenderer.send("app-zoom-noResize", zoom)
            EventBus.emit("app-zoom", zoom)
        },
        setupAppSuspension() {
            if (ipcRenderer) ipcRenderer.send("app-suspension", this.track.playingWithoutSleeping)
        },
        setupTray() {
            if (ipcRenderer) ipcRenderer.send("app-tray", this.tray.show)
        },
        setupGlobalShortcut() {
            if (ipcRenderer) ipcRenderer.send("app-globalShortcut", this.keys.global)
        },
        setupFontFamily() {
            EventBus.emit('setting-fontFamily', this.common.fontFamily)
        },
        setupFontWeight() {
            const weight = this.common.fontWeight || 400
            EventBus.emit('setting-fontWeight', weight)
        },
        updateBlackHole(value) {
            this.blackHole = value
        },
        allQualities() {
            return QUALITIES
        },
        resolveFont(value) {
            value = (value || '').trim()
            value = value.replaceAll("'", "").replaceAll('"', '')
            if (value.includes(" ")) value = '"' + value + '"'
            return value
        },
        formatFontFamily(value) {
            let fontFamily = (value || '').trim()
            const fonts = fontFamily.split(',')
            if (fonts.length > 1) {
                let temp = ''
                fonts.reduce((prev, curr) => {
                    temp = temp + "," + this.resolveFont(prev) + "," + this.resolveFont(curr)
                    temp = temp.trim()
                })
                fontFamily = temp.substring(1).replaceAll(",,", ",")
            } else {
                fontFamily = this.resolveFont(fontFamily)
            }
            return fontFamily
        },
        setFontFamily(value) {
            this.common.fontFamily = this.formatFontFamily(value)
            this.setupFontFamily()
        },
        setFontWeight(value) {
            const weight = parseInt(value || 400)
            if (weight < 100 || weight > 1000) return
            this.common.fontWeight = weight
            this.setupFontWeight()
        },
        setLyricFontSize(value) {
            const fontSize = parseInt(value || 18)
            if (fontSize < 10 || fontSize > 100) return
            this.lyric.fontSize = fontSize
            this.setupLyricFontSize()
        },
        setLyricHighlightFontSize(value) {
            const fontSize = parseInt(value || 21)
            if (fontSize < 10 || fontSize > 100) return
            this.lyric.hlFontSize = fontSize
            this.setupLyricHighlightFontSize()
        },
        setLyricFontWeight(value) {
            const weight = parseInt(value || 400)
            if (weight < 100 || weight > 1000) return
            this.lyric.fontWeight = weight
            this.setupLyricFontWeight()
        },
        setLyricLineHeight(value) {
            const lineHeight = parseInt(value || 28)
            if (lineHeight < 10 || lineHeight > 168) return
            this.lyric.lineHeight = lineHeight
            this.setupLyricLineHeight()
        },
        setLyricLineSpacing(value) {
            const lineSpacing = parseInt(value || 26)
            if (lineSpacing < 0 || lineSpacing > 100) return
            this.lyric.lineSpacing = lineSpacing
            this.setupLyricLineSpacing()
        },
        setLyricOffset(value) {
            const offset = parseInt(value || 0)
            this.lyric.offset = offset
            this.setupLyricOffset()
        },
        setLyricMetaPos(value) {
            this.lyric.metaPos = value || 0
            this.setupLyricMetaPos()
        },
        setLyricAlignment(value) {
            this.lyric.alignment = value || 0
            this.setupLyricAlignment()
        },
        resetLyricSetting() {
            this.setLyricFontSize()
            this.setLyricHighlightFontSize()
            this.setLyricLineHeight()
            this.setLyricLineSpacing()
            this.setLyricFontWeight()
            this.setLyricOffset()
            this.setLyricMetaPos()
            this.setLyricAlignment()
        },
        setupLyricFontSize() {
            const fontSize = this.lyric.fontSize || 18
            EventBus.emit('lyric-fontSize', fontSize)
        },
        setupLyricHighlightFontSize() {
            const fontSize = this.lyric.hlFontSize || 21
            EventBus.emit('lyric-hlFontSize', fontSize)
        },
        setupLyricFontWeight() {
            const fontWeight = this.lyric.fontWeight || 400
            EventBus.emit('lyric-fontWeight', fontWeight)
        },
        setupLyricLineHeight() {
            const lineHeight = this.lyric.lineHeight || 28
            EventBus.emit('lyric-lineHeight', lineHeight)
        },
        setupLyricLineSpacing() {
            const lineSpacing = this.lyric.lineSpacing || 26
            EventBus.emit('lyric-lineSpacing', lineSpacing)
        },
        setupLyricOffset() {
            const offset = this.lyric.offset || 0
            EventBus.emit('lyric-offset', offset)
        },
        setupLyricMetaPos() {
            const metaPos = this.lyric.metaPos || 0
            EventBus.emit('lyric-metaPos', metaPos)
        },
        setupLyricAlignment() {
            const alignment = this.lyric.alignment || 0
            EventBus.emit('lyric-alignment', alignment)
        },
        toggleHttpProxy() {
            this.network.httpProxy.enable = !this.network.httpProxy.enable
        },
        setHttpProxy(host, port, username, password) {
            this.network.httpProxy.host = host
            this.network.httpProxy.port = parseInt(port) || 80
            this.network.httpProxy.username = username
            this.network.httpProxy.password = password
        },
        resetHttpProxy() {
            this.network.httpProxy.enable = false
            this.setHttpProxy(null, 80, null, null)
        },
        toggleSocksProxy() {
            this.network.socksProxy.enable = !this.network.socksProxy.enable
        },
        setSocksProxy(host, port, username, password) {
            this.network.socksProxy.host = host
            this.network.socksProxy.port = parseInt(port) || 80
            this.network.socksProxy.username = username
            this.network.socksProxy.password = password
        },
        resetSocksProxy() {
            this.network.socksProxy.enable = false
            this.setSocksProxy(null, 80, null, null)
        },
        resetProxies() {
            this.resetHttpProxy()
            this.resetSocksProxy()
        },
        setupAppGlobalProxy() {
            const proxy = { http: null, socks: null }
            if (this.isHttpProxyEnable) {
                const { host, port, username, password } = this.network.httpProxy
                Object.assign(proxy, { http: { host, port, username, password } })
            }
            if (this.isSocksProxyEnable) {
                const { host, port, username, password } = this.network.socksProxy
                Object.assign(proxy, { socks: { host, port, username, password } })
            }
            if (ipcRenderer) ipcRenderer.send('app-setGlobalProxy', proxy)
        },
    },
    persist: {
        enabled: true,
        strategies: [
            {
                //key: 'setting',
                storage: localStorage,
                paths: ['theme', 'layout', 'common', 'track',
                    'lyric', 'cache', 'tray', 'navigation',
                    'dialog', 'keys', 'network']
            },
        ],
    },
})
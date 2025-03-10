<script setup>
import { inject, onMounted, watch } from 'vue';
import { usePlayStore } from './store/playStore';
import { useAppCommonStore } from './store/appCommonStore';
import { usePlatformStore } from './store/platformStore';
import EventBus from '../common/EventBus';
import { Track } from '../common/Track';
import { storeToRefs } from 'pinia';
import { useUserProfileStore } from './store/userProfileStore';
import { useIpcRenderer } from '../common/Utils';
import { PLAY_STATE, TRAY_ACTION } from '../common/Constants';
import { useSettingStore } from './store/settingStore';
import { Playlist } from '../common/Playlist';

const ipcRenderer = useIpcRenderer()

const { currentTrack, queueTracksSize } = storeToRefs(usePlayStore())
const { playTrack, playNextTrack, 
    setAutoPlaying, playPrevTrack, 
    togglePlay, switchPlayMode,
    toggleVolumeMute, updateVolumeByOffset,
    updateCurrentTime, setPlaying,
    resetQueue, addTracks, 
    addTrack, playTrackDirectly,
    isCurrentTrack, isPlaying } = usePlayStore()
const { getVendor, isLocalMusic } = usePlatformStore()
const { playingViewShow ,videoPlayingViewShow, 
    playingViewThemeIndex, spectrumIndex } = storeToRefs(useAppCommonStore())
const { togglePlaybackQueueView, toggleVideoPlayingView, 
    showFailToast, toggleLyricToolbar,
    showToast, isCurrentTraceId } = useAppCommonStore()
const { addRecentSong, addRecentRadio, 
    addRecentPlaylist, addRecentAlbum } = useUserProfileStore()
const { isStorePlayStateBeforeQuit, isStoreLocalMusicBeforeQuit, 
    theme, layout,
    isStoreRecentPlay } = storeToRefs(useSettingStore())
const { getCurrentThemeHlColor } = useSettingStore()

const { visitHome, visitUserHome, visitSetting } = inject('appRoute')

/* 记录最近播放 */
//歌曲、电台
const traceRecentTrack = (track) => {
    if(!isStoreRecentPlay.value) return
    const { platform } = track
    if(isLocalMusic(platform)) return
    if(Playlist.isFMRadioType(track)) {
        addRecentRadio(track)
    } else {
        addRecentSong(track)
    }
    EventBus.emit("userHome-refresh")
}

//歌单
const traceRecentPlaylist = (playlist) => {
    if(!isStoreRecentPlay.value) return
    if(Playlist.isCustomType(playlist)) return
    if(Playlist.isFMRadioType(playlist)) return
    const { id, platform, title, cover, type } = playlist
    addRecentPlaylist(id, platform, title, cover, type)
}

//专辑
const traceRecentAlbum = (album) => {
    if(!isStoreRecentPlay.value) return
    const { id, platform, title, cover, publishTime } = album
    addRecentAlbum(id, platform, title, cover, publishTime)
}



/* 歌词获取 */
const loadLyric = (track) => {
    if(!track) return 
    if(Track.hasLyric(track)) {
        EventBus.emit('track-lyricLoaded', track)
        return 
    }
    const platform = track.platform
    const vendor = getVendor(platform);
    if(!vendor) return 
    if(Playlist.isFMRadioType(track) || Playlist.isAnchorRadioType(track)) return 
    vendor.lyric(track.id, track).then(result => assignLyric(track, result))
}

const assignLyric = (track, lyric) => {
    //track.lyric = result
    if(!track) return
    if(!lyric) return
    Object.assign(track, { lyric })
    EventBus.emit('track-lyricLoaded', track)
}


//处理不可播放歌曲
const AUTO_PLAY_NEXT_MSG = '当前歌曲无法播放<br>即将为您播放下一曲'
const NO_NEXT_MSG = '当前歌曲无法播放<br>且列表已无其他歌曲'
const TOO_FAST_MSG = '尝试播放次数太多<br>请手动播放其他歌曲吧'
//连跳计数器
let autoSkipCnt = 0
//重置连跳计数
const resetAutoSkip = () => autoSkipCnt = 0

//用户手动干预，即主动点击上/下一曲时，产生体验上的Bug
//目前实现方式已稍作处理
const handleUnplayableTrack = (track) => {
    const queueSize = queueTracksSize.value
    const isPlaylistRadio = Playlist.isNormalRadioType(track)
    //提示并播放下一曲
    const toastAndPlayNext = () => {
        //前提条件：必须是当前歌曲
        if(isCurrentTrack(track)) {
            showFailToast(AUTO_PLAY_NEXT_MSG, () => {
                if(isCurrentTrack(track)) playNextTrack()
            })
        }
    }
    if(isPlaylistRadio) { //普通歌单电台
        toastAndPlayNext()
        return
    } else if(queueSize < 2) { //非电台歌曲，且没有下一曲
        showFailToast(NO_NEXT_MSG)
        return
    } 
    //普通歌曲
    //频繁切换下一曲，体验不好，对音乐平台也不友好
    if(autoSkipCnt < 9) { 
        ++autoSkipCnt
        toastAndPlayNext()
        return
    }
    //10连跳啦，暂停一下吧
    resetAutoSkip()
    showFailToast(TOO_FAST_MSG)
}

//获取和设置歌曲播放信息
const bootstrapTrack =  (track) => {
    return new Promise(async (resolve, reject) => {
        if(!track) { 
            reject() 
            return 
        }
        //FM电台不需要再处理
        if(Playlist.isFMRadioType(track)) { 
            reject() 
            return 
        }
        const { id, platform, artistNotCompleted }= track
        //本地音乐也不需要再处理
        if(isLocalMusic(platform)) { 
            reject() 
            return 
        } 
        //平台服务
        const vendor = getVendor(platform)
        if(!vendor  || !vendor.playDetail) { 
            reject() 
            return 
        } 
        //播放相关数据
        const result = await vendor.playDetail(id, track)
        const { lyric, cover, artist, url } = result
        //覆盖设置url，音乐平台可能有失效机制，即url只在允许的时间内有效，而非永久性url
        if(Track.hasUrl(result)) Object.assign(track, { url })
        //无法获取到有效url
        if(!Track.hasUrl(track)) { //VIP收费歌曲或其他
            reject('noUrl')
            return
        }
        setAutoPlaying(false)
        //设置歌词
        if(Track.hasLyric(result)) assignLyric(track, lyric)
        //设置封面
        if(Track.hasCover(result)) Object.assign(track, { cover })
        //设置歌手信息
        //TODO 部分音乐平台artist信息无法在同一API中完整获取
        if(artistNotCompleted && artist) { 
            Object.assign(track, { artist })
            EventBus.emit('track-artistUpdated', { trackId: id, artist })
        }
        resolve(track)
    })
}

//添加到播放列表，并开始播放
const addAndPlayTracks = (tracks, needReset, text, traceId) => {
    if(traceId && !isCurrentTraceId(traceId)) return

    if(needReset) resetQueue()
    showToast(text || "即将为您播放全部！")
    addTracks(tracks)
    playNextTrack()
}

//接收播放器错误通知，重试播放
const onPlayerErrorRetry = (track) => {
    if(!track) { //超出最大重试次数
        playNextTrack()
    } else {
        EventBus.emit('track-changed', track)
    }
}

/* 播放歌单 */
const tryPlayPlaylist = async(playlist, text, traceId) => {
    try {
        playPlaylist(playlist, text, traceId)
    } catch(error) {
        console.log(error)
        if(traceId && !isCurrentTraceId(traceId)) return
        showFailToast('网络异常！请稍候重试')
        return
    }
}

//播放歌单
const playPlaylist = async (playlist, text, traceId) => {
    if(traceId && !isCurrentTraceId(traceId)) return

    const { id, platform } = playlist
    if(Playlist.isFMRadioType(playlist)) { //FM广播电台
        if(text) showToast(text)
        const track = playlist.data[0]
        addTrack(track)
        playTrack(track)
        return
    } else if(Playlist.isNormalRadioType(playlist)) { //歌单电台
        //提示前置，避免因网络卡顿导致用户多次请求
        if(text) showToast(text)
        playNextPlaylistRadioTrack(platform, id, traceId)
        return
    } else if(Playlist.isNormalType(playlist) 
        || Playlist.isAnchorRadioType(playlist)) {
        let maxRetry = 3, retry = 0
        while(!playlist.data || playlist.data.length < 1) {
            if(traceId && !isCurrentTraceId(traceId)) return

            if(++retry > maxRetry) return
            //重试一次加载数据
            const vendor = getVendor(platform)
            if(!vendor || !vendor.playlistDetail) return 
            playlist = await vendor.playlistDetail(id, 0, 1000, 1)
        }
    }
    if(!playlist.data || playlist.data.length < 1) {
        const failMsg = Playlist.isCustomType(playlist) ? '歌单里还没有歌曲'
            : '网络异常！请稍候重试'
        if(traceId && !isCurrentTraceId(traceId)) return
        showFailToast(failMsg)
        return
    }
    //可播放歌单
    traceRecentPlaylist(playlist)
    addAndPlayTracks(playlist.data, true, text || '即将为您播放歌单', traceId)
}

//播放电台
const playNextPlaylistRadioTrack = async (platform, channel, track, traceId) => {
    if(traceId && !isCurrentTraceId(traceId)) return

    const vendor = getVendor(platform)
    if(!vendor || !vendor.nextPlaylistRadioTrack) {
        showFailToast('网络异常！请稍候重试')
        return
    }
    const needReset = !Track.hasId(track)
    let maxRetry = 3, retry = 0, success = false
    do {
        if(traceId && !isCurrentTraceId(traceId)) return

        const result = await vendor.nextPlaylistRadioTrack(channel, track)
        if(!Track.hasId(result)) {
            ++retry
            continue
        }
        if(needReset) resetQueue()
        addTrack(result)
        playTrack(result)
        success = true
        break 
    } while(retry > 0 && retry < maxRetry)
    if(!success) {
        if(traceId && !isCurrentTraceId(traceId)) return
        showFailToast('网络异常！请稍候重试')
    }
}

//播放专辑
const playAlbum = (album, text) => {
    if(!album || !album.data || album.data.length < 1) {
        showFailToast('网络异常！请稍候重试')
        return 
    }
    traceRecentAlbum(album)
    addAndPlayTracks(album.data, true, text)
}


/* 频谱 */
let cachedFreqData = null, spectrumColor = null, stroke = null
const drawSpectrum = (canvas, freqData, alignment) => {
    spectrumColor = getCurrentThemeHlColor()
    stroke = spectrumColor

    const dataLen = freqData.length
    const WIDTH = canvas.width, HEIGHT = canvas.height

    const canvasCtx = canvas.getContext("2d")
    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT)

    canvasCtx.fillStyle = 'transparent'
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT)

    if(!freqData || freqData.length < 1) return 
    let barWidth = 1/2,barHeight, x = 2, spacing = 3
    //barWidth = (WIDTH / (dataLen * 3))

    for(var i = 0; i < dataLen; i++) {
        //if( (x + barWidth + spacing) >= WIDTH) break

        barHeight = freqData[i]/ 255 * HEIGHT 
        barHeight = barHeight > 0 ? barHeight : 1

        canvasCtx.fillStyle = spectrumColor
        canvasCtx.strokeStyle = stroke
        canvasCtx.shadowBlur = stroke
        canvasCtx.shadowColor = stroke

        //roundedRect(canvasCtx, x, HEIGHT - barHeight, barWidth, barHeight, 5)
        let y = (HEIGHT - barHeight) //alignment => bottom
        if(alignment == 'top') y = 0
        else if(alignment == 'center') y = (HEIGHT - barHeight)/2

        canvasCtx.fillRect(x, y, barWidth, barHeight)
        if(barHeight > 0) canvasCtx.strokeRect(x, y, barWidth, barHeight)
        
        x += barWidth + spacing
    }
}

const drawGridSpectrum = (canvas, freqData, alignment) => {
    spectrumColor = getCurrentThemeHlColor()
    stroke = spectrumColor
    const WIDTH = canvas.width, HEIGHT = canvas.height
    const canvasCtx = canvas.getContext("2d")

    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT)

    canvasCtx.fillStyle = 'transparent'
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT)

    if(!freqData || freqData.length < 1) return 
    let barWidth = 6, barHeight, cellHeight = 2, x = 2, hspacing = 2, vspacing = 1

    for(var i = 0; i < 100; i++) {
        if( (x + barWidth + hspacing) >= WIDTH) break

        barHeight = freqData[i]/ 255 * HEIGHT 
        barHeight = barHeight > 0 ? barHeight : cellHeight
        const cellSize = Math.floor(barHeight / (cellHeight + vspacing))
        
        canvasCtx.fillStyle = spectrumColor
        canvasCtx.strokeStyle = stroke
        canvasCtx.shadowBlur = stroke
        canvasCtx.shadowColor = stroke

        for(var j = 0; j < cellSize; j++) {
            const barHeight = j * (cellHeight + vspacing)
            let y = HEIGHT - barHeight //alignment => bottom
            if(alignment == 'top') y = barHeight 
            else if(alignment == 'center') y = y/2

            canvasCtx.fillRect(x, y, barWidth, cellHeight)
            //canvasCtx.strokeRect(x, y, barWidth, cellHeight)
        }
        
        x += barWidth + hspacing
    }
}

const drawCanvasSpectrum = () => {
    const canvas = document.querySelector(".spectrum-canvas")
    if(!canvas) return
    const index = spectrumIndex.value
    let alignment = 'bottom'
    switch(index) {
        case 1:
        case 3:
            drawGridSpectrum(canvas, cachedFreqData, alignment)
            break
        case 2:
            alignment = 'center'
        default:
            drawSpectrum(canvas, cachedFreqData, alignment)
            break
    }
}

//获取视频信息 
const getVideoDetail = (platform, id) => {
    return new Promise((resolve, reject) => {
        const vendor = getVendor(platform)
        if(!vendor) {
            if(reject) reject('NoVendor')
            return 
        }
        const quality = '1080'
        vendor.videoDetail(id, quality).then(result => {
            if(!result.url || result.url.trim().length < 1) {
                if(reject) reject('NoURL')
                return
            }
            resolve(result)
        })
    })
}



/* EventBus事件 */
//FM广播
EventBus.on('radio-play', track => traceRecentTrack(track))
EventBus.on('radio-state', state => setPlaying(state))
//普通歌曲
EventBus.on('track-changed', track => {
    bootstrapTrack(track).then(track => {
        if(isCurrentTrack(track)) playTrackDirectly(track)
    }, reason => {
        if(reason == 'noUrl') handleUnplayableTrack(track)
    })
})
EventBus.on('track-play', track => {
    resetAutoSkip()
    traceRecentTrack(track)
    loadLyric(track)
})
EventBus.on('track-loadLyric', track => loadLyric(track))
EventBus.on('track-error', track => onPlayerErrorRetry(track))
EventBus.on('track-state', state => {
    switch(state) {
        case PLAY_STATE.PLAYING:
            setPlaying(true)
            break;
        case PLAY_STATE.PAUSE:
            setPlaying(false)
            break;
        case PLAY_STATE.END:
            playNextTrack()
            break;
        default:
            break
    }
})
EventBus.on('track-pos', secs => {
    if(videoPlayingViewShow.value) {
        if(isPlaying()) togglePlay()
        return 
    }
    updateCurrentTime(secs)
})

//播放歌曲
EventBus.on('track-playNow', track => playTrack(track))

//歌单电台 - 下一曲
EventBus.on('track-nextPlaylistRadioTrack', track => 
    playNextPlaylistRadioTrack(track.platform, track.channel, track))

//播放MV
EventBus.on('track-playMv', track => {
    if(!Track.hasMv(track)) return
    const { platform, mv } = track
    getVideoDetail(platform, mv).then(result => {
        if(isPlaying()) togglePlay()
        toggleVideoPlayingView()
        EventBus.emit('video-play', result)
        traceRecentTrack(track)
    }, reason => showFailToast('当前MV无法播放！'))
})

EventBus.on("track-freqUnit8Data", freqData => {
    cachedFreqData = freqData
    if(playingViewThemeIndex.value != 1 && layout.value.index != 2) return
    drawCanvasSpectrum()
})

//歌单
EventBus.on('playlist-play', ({ playlist, text, traceId }) => tryPlayPlaylist(playlist, text, traceId))

//专辑
EventBus.on('album-play', ({ album, text }) => playAlbum(album, text))

//歌曲数组
EventBus.on('tracks-play', ({ data, needReset, text }) => addAndPlayTracks(data, needReset, text))

EventBus.on('queue-empty', )


//设置RadioPlayer
const setupRadioPlayer = () => EventBus.emit('radio-init', document.querySelector('.audio-node'))

//应用启动时，恢复歌曲信息
const restoreTrack = () => {
    bootstrapTrack(currentTrack.value, true).then(track => {
        EventBus.emit("track-restore", track)
    }).catch(error => console.log(error))
}

//注册ipcMain消息监听器
const registryIpcRenderderListeners = () => {
    if(!ipcRenderer) return 
    //Tray事件
    ipcRenderer.on("tray-action", (e, value) => {
        //TODO 视频播放中，暂时不允许中断
        if(videoPlayingViewShow.value) return
        switch(value) {
            case TRAY_ACTION.PLAY: 
            case TRAY_ACTION.PAUSE:
                togglePlay()
                break
            case TRAY_ACTION.PLAY_PREV:
                playPrevTrack()
                break
            case TRAY_ACTION.PLAY_NEXT:
                playNextTrack()
                break
            case TRAY_ACTION.HOME:
                visitHome()
                break
            case TRAY_ACTION.USERHOME:
                visitUserHome()
                break
            case TRAY_ACTION.SETTING:
                visitSetting()
                break
        }
    })
    
    //全局快捷键
    ipcRenderer.on('globalShortcut-togglePlay', togglePlay)
    ipcRenderer.on('globalShortcut-switchPlayMode', switchPlayMode)
    ipcRenderer.on('globalShortcut-playPrev', playPrevTrack)
    ipcRenderer.on('globalShortcut-playNext', playNextTrack)
    ipcRenderer.on('globalShortcut-volumeUp', () => updateVolumeByOffset(0.05))
    ipcRenderer.on('globalShortcut-volumeDown', () => updateVolumeByOffset(-0.05))
    ipcRenderer.on('globalShortcut-toggleVolumeMute', toggleVolumeMute)
    ipcRenderer.on('globalShortcut-visitSetting', () => visitSetting())
    ipcRenderer.on('globalShortcut-togglePlaybackQueue', togglePlaybackQueueView)
    ipcRenderer.on('globalShortcut-toggleLyricToolbar', () => {
        if(playingViewShow.value) toggleLyricToolbar() 
    })
    
    //其他事件
    ipcRenderer.on('app-quit', () => {
        if(!isStorePlayStateBeforeQuit.value) {
            localStorage.removeItem('player')
        }
        if(!isStoreLocalMusicBeforeQuit.value) {
            localStorage.removeItem('localMusic')
        }
    })
}
registryIpcRenderderListeners()

onMounted(() => {
    setupRadioPlayer()
    restoreTrack()
})

watch(queueTracksSize, (nv, ov) => {
    if(nv < 1) EventBus.emit('playbackQueue-empty')
})
//TODO
watch(theme, () => {
    if(isPlaying() || (playingViewThemeIndex.value != 1 
            && layout.value.index != 2)) {
        return
    }
    drawCanvasSpectrum()
}, { deep: true })
</script>

<template>
    <!-- FM广播audio -->
    <audio class="audio-node" crossOrigin="anonymous"></audio>
    <slot></slot>
</template>
<style>
.radio-holder {
  visibility: hidden;
}
</style>
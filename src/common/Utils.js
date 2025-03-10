//import analyze from 'rgbaster';

export const useIpcRenderer = () => {
    try {
        return electronAPI ? electronAPI.ipcRenderer : null
    } catch (error) {
        //Do Nothing
    }
    return null
}

export const isMacOS = () => {
    try {
        return electronAPI ? electronAPI.isMacOS : null
    } catch (error) {
        //Do Nothing
    }
    return null
}

export const isWinOS = () => {
    try {
        return electronAPI ? electronAPI.isWinOS : null
    } catch (error) {
        //Do Nothing
    }
    return null
}

export const useUseCustomTrafficLight = () => {
    try {
        return electronAPI ? electronAPI.useCustomTrafficLight : false
    } catch (error) {
        //Do Nothing
    }
    return false
}

export const ALPHABETS = 'ABCDEFGHIJKLMNOPQRSTUVWSYZabcdefghijklmnopqrstuvwsyz'
export const ALPHABET_NUMS = ALPHABETS + '01234567890'

/** 随机字符串
 * @param src 限定组成元素的字符串，如：ABCDEFGHIJKLMNOPQRSTUVWSYZ
 * @param len 长度
 */
export const randomText = (src, len) => {
    let result = []
    for (let i = 0; i < len; i++) {
        const index = Math.floor(Math.random() * (src.length - 1))
        result.push(src.charAt(index))
    }
    return result.join('')
}

/** 随机字符串: 只有大小写字母组成 */
export const randomTextWithinAlphabet = (len) => (randomText(ALPHABETS, len))

/** 随机字符串: 大小写字母和数字组成 */
export const randomTextWithinAlphabetNums = (len) => (randomText(ALPHABET_NUMS, len))

export const toTrimString = (value) => {
    value = value === 0 ? '0' : value
    return (value || '').toString().trim()
}

/*
export const useRgbaster = async (src, opts) => {
    return new Promise((resolve, reject) => {
        analyze(src, opts).then(result => {
            let recommandColor = '#000'
            if(!result || result.length < 1) {
                resolve(recommandColor)
                return
            }
            const { color } = result[0] //dominant color 主色
            const rgbs = color.split('(')[1].replace(')', '').split(',')
            const r = parseInt(rgbs[0]), g = parseInt(rgbs[1]), b = parseInt(rgbs[2])
            //recommandColor = (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#000' : '#fff'
            recommandColor = (r * 0.213 + g * 0.715 + b * 0.072) > 255 / 2 ? '#000' : '#fff'
            resolve(recommandColor)
        })
    })
}
*/

export const nextInt = (max) => {
    const limit = max < 1024 ? 1024 : max
    return parseInt(Math.random() * limit) % max
}
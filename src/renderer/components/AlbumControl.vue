<script setup>
import { inject } from 'vue';

const { visitAlbum } = inject('appRoute')

const props = defineProps({
    visitable: Boolean,
    platform: String,
    data: Object
})

const visitAlbumDetail = (platform, id, callback) => {
    if(!props.visitable) return 
    visitAlbum({ platform, id, callback })
}
</script>

<template>
    <span @click="visitAlbumDetail(platform, data.id)" 
        class="album-ctl" v-html="data.name" > 
    </span>
</template>

<style>
.album-ctl {
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    /* -webkit-app-region: none; */
    text-align: left;
}

.album-ctl:hover {
    background: var(--hl-text-bg);
    -webkit-background-clip: text;
    color: transparent;
}
</style>
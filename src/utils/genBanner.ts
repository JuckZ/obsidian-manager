import { getAllFiles } from 'utils/file';
import { request } from 'utils/request';
import { createClient } from 'pexels';
import type { TFile } from 'obsidian';

const colorSchema = [
    '293845-81DC0A',
    '293845-2043D4',
    '293845-BB3EB6',
    '293845-C2DEF9',
    '293845-60A718',
    '293845-95F8BC',
    '293845-B13FD0',
    '293845-D73412',
    '293845-F68E9B',
    '293845-A31852',
    '293845-DD04BC',
    '293845-F49976',
    '293845-599846',
    '293845-3E80EF',
    '293845-8C26D7',
    '293845-3BDBD2',
    '293845-66852B',
    '293845-EEEE0B',
    '293845-565ECE',
];
export const imgpath = async (title, folders) => {
    if (title && title.match(/\d{4}-\d{1,2}-\d{1,2}/)) {
        const images = await getAllFiles(folders, []);
        return images[Math.floor(Math.random() * images.length)].path;
    } else {
        const color = colorSchema[Math.floor(Math.random() * colorSchema.length)].split('-');
        return `https://dummyimage.com/700x400/${color[1]}/${color[0]}.png&text=` + title;
    }
};

export const getApiKey = (source: string): string => {
    switch (source) {
        case 'pixabay':
            return '33358907-a473239cc878e8873ceea9435';
        case 'pexels':
            return 'BKO0qN5V9jHyKch6VeSz3n6PtnGaD8VDLht9cTjiJnDVqkKv7oSEBxJc';
        default:
            return '';
    }
};

const pexelsClient = createClient(getApiKey('pexels'));
let color;
let templaterRes;
let localImages: TFile[] = [];
let pixabayRes;
let pexelsRes;

export const searchPicture = async (source: string, keyword: string, folders?: string): Promise<string> => {
    // TODO 可以翻译成英文后搜索,将关键词拆分后搜索
    let englishKeyword = keyword;
    englishKeyword = await new Promise((resolve, reject) => {
        request
            .get(`http://localhost:8080/baidu_translate/vip/translate?keyword=${keyword}`)
            .then(res => {
                resolve(res.data.trans_result[0].dst);
            })
            .catch(error => {
                reject(error);
            });
    });

    switch (source) {
        case 'pixabay':
            pixabayRes = await new Promise((resolve, reject) => {
                request
                    .get(
                        `https://pixabay.com/api/?key=${getApiKey(
                            source,
                        )}&q=${englishKeyword}&image_type=photo&pretty=true&min_width=600&order=popular`,
                    )
                    .then(res => {
                        resolve(res);
                    })
                    .catch(error => reject(error));
            });
            if (pixabayRes.status === 200 && pixabayRes?.data?.total) {
                return pixabayRes.data.hits[0].largeImageURL;
            } else {
                return '';
            }
        case 'pexels':
            pexelsRes = await new Promise((resolve, reject) => {
                pexelsClient.photos.search({ query: englishKeyword, size: 'large', per_page: 1 }).then(photos => {
                    resolve(photos);
                });
            });
            if (pexelsRes?.photos.length > 0) {
                return pexelsRes.photos[0].src.medium;
            } else {
                return '';
            }
        case 'dummyimage':
            color = colorSchema[Math.floor(Math.random() * colorSchema.length)].split('-');
            return `https://dummyimage.com/700x400/${color[1]}/${color[0]}.png&text=` + keyword;
        case 'deepai':
            // TODO 调用deepart AI生成图片
            return '';
        case 'random':
            localImages = await getAllFiles(folders || 'assets/banner', []);
            return localImages[Math.floor(Math.random() * localImages.length)].path;
        case 'localmatch':
            // TODO 关键词匹配法，寻找本地图片 #ing
            return '';
        case 'templater':
            templaterRes = await app.plugins.plugins[
                'templater-obsidian'
            ].templater.current_functions_object.web.random_picture('600x400', keyword);
            return templaterRes.match(/\((.+?)\)/)[1];
        default:
            return '';
    }
};

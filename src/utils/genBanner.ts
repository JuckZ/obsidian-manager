import type { AxiosResponse } from 'axios';
import { request } from 'utils/request';

export const searchPicture = async (source: string, keyword: string): Promise<string> => {
    const res: AxiosResponse = await new Promise((resolve, reject) => {
        request
            // .get(`https://api.ihave.cool/gen_image/from_keyword?origin=${source}&keyword=${keyword}`)
            .get(`https://api.ihave.cool/gen_image/from_keyword?origin=${source}&keyword=${keyword}`)
            .then(res => {
                console.log(res);
                resolve(res);
            })
            .catch(error => reject(error));
    });
    if (res.status === 200 && res?.data) {
        return res.data;
    } else {
        return '';
    }
};

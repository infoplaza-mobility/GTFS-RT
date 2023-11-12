/*
 * Copyright (c) 2023. R-OV / Tristan van Triest
 * This file is part of the R-OV source code and thus shall not be shared. Please respect the copyright of the original owner.
 * Questions? Email: tristantriest@gmail.com
 */

import { writeFile } from 'fs/promises';
import Axios from 'axios';

export interface IRemoteFileService {
    /**
     * Downloads a file from a remote directory and saves it to a local directory.
     * @param url The URL of the file to download
     * @param destination The destination of the file to save
     * @throws Error if the file could not be downloaded or saved to the target destination
     */
    downloadFile(url: string, destination: string): Promise<void>;
}

export class RemoteFileService implements IRemoteFileService {
    public constructor() {
    }

    /** @inheritDoc */
    public async downloadFile(url: string, destination: string): Promise<void> {
        const file = await this.downloadFromRemote(url);

        await this.writeToFile(destination, file);
    }

    /**
     * Downloads a file from a remote directory.
     * @param url The URL of the file to download
     * @throws Error if the file could not be downloaded
     * @private
     */
    private async downloadFromRemote(url: string): Promise<Buffer> {
        const response = await Axios.get(url, {
            responseType: 'arraybuffer'
        })

        if(response.status !== 200)
            throw new Error(`Failed to download file from ${url} with error code ${response.status}`);

        return response.data;
    }

    private async writeToFile(destination: string, data: Buffer): Promise<void> {
        await writeFile(destination, data);
    }
}
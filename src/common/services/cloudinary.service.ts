import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private configured = false;

  constructor(private configService: ConfigService) {}

  private ensureConfigured() {
    if (this.configured) return;
    const cloud_name = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const api_key = this.configService.get<string>('CLOUDINARY_API_KEY');
    const api_secret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    if (!cloud_name || !api_key || !api_secret) {
      throw new BadRequestException('Cloudinary is not configured');
    }
    cloudinary.config({ cloud_name, api_key, api_secret });
    this.configured = true;
  }

  uploadBuffer(buffer: Buffer, folder: string): Promise<UploadApiResponse> {
    this.ensureConfigured();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
          resolve(result);
        },
      );
      stream.end(buffer);
    });
  }
}

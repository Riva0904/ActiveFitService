import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { CloudinaryService } from './services/cloudinary.service';

@Global()
@Module({
  providers: [AuditService, CloudinaryService],
  exports: [AuditService, CloudinaryService],
})
export class CommonModule {}

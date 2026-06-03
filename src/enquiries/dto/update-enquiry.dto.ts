import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { EnquiryStatus } from '@prisma/client';
import { CreateEnquiryDto } from './create-enquiry.dto';

export class UpdateEnquiryDto extends PartialType(CreateEnquiryDto) {
  @IsOptional()
  @IsEnum(EnquiryStatus)
  status?: EnquiryStatus;
}

export class ConvertEnquiryDto {
  @IsOptional()
  @IsString()
  userId?: string;
}

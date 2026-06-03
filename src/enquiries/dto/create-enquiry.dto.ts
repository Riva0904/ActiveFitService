import { IsString, IsOptional, IsEmail, IsEnum, IsDateString } from 'class-validator';
import { EnquirySource } from '@prisma/client';

export class CreateEnquiryDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(EnquirySource)
  source?: EnquirySource;

  @IsOptional()
  @IsString()
  interest?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}

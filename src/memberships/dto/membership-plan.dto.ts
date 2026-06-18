import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMembershipPlanDto {
  @ApiProperty({ required: false, description: 'SUPER_ADMIN only — target gym' })
  @IsOptional()
  @IsString()
  gymId?: string;

  @ApiProperty({ example: 'Monthly Basic' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'MONTHLY', required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  durationMonths: number;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ required: false, example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  features?: string[];

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMembershipPlanDto {
  @ApiProperty({ required: false, description: 'SUPER_ADMIN only — target gym' })
  @IsOptional()
  @IsString()
  gymId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  features?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMonths?: number;
}

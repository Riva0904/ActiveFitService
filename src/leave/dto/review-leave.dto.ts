import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewLeaveDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adminNote?: string;
}

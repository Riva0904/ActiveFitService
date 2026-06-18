import { IsString, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveType } from '@prisma/client';

export class ApplyLeaveDto {
  @ApiProperty({ enum: LeaveType })
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-07-02' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 'Family event' })
  @IsString()
  reason: string;
}

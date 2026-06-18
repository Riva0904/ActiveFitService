import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentType } from '@prisma/client';

export class RecordCashPaymentDto {
  @ApiProperty({ description: 'Member.id (not User.id)' })
  @IsString()
  memberId: string;

  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subscriptionId?: string;
}

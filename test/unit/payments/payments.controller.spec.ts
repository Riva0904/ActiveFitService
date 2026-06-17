import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsController } from '../../../src/payments/payments.controller';
import { PaymentsService } from '../../../src/payments/payments.service';

const mockPaymentsService = { createRazorpayOrder: jest.fn() };

describe('PaymentsController — createOrder type lockdown', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    jest.clearAllMocks();
  });

  it('allows MEMBERSHIP (the only type with a server-side re-priced flow on this endpoint)', () => {
    const user = { id: 'u1', gymId: 'g1' };
    controller.createOrder({ amount: 1, type: 'MEMBERSHIP' }, user);
    expect(mockPaymentsService.createRazorpayOrder).toHaveBeenCalled();
  });

  it.each(['DIET_PLAN', 'PT_SESSION', 'WORKOUT_PLAN', 'SUPPLEMENT', 'OTHER'])(
    'rejects %s — those go through their own dedicated purchase endpoints, not this one',
    (type) => {
      const user = { id: 'u1', gymId: 'g1' };
      expect(() => controller.createOrder({ amount: 1, type }, user)).toThrow(BadRequestException);
      expect(mockPaymentsService.createRazorpayOrder).not.toHaveBeenCalled();
    },
  );
});

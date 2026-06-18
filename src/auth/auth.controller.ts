import { Controller, Post, Get, Body, UseGuards, Patch, HttpCode, HttpStatus, Res, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto, RegisterGymDto, LoginDto, ChangePasswordDto, ForgotPasswordDto,
  ResetPasswordDto, VerifyEmailDto, ResendOtpDto, Verify2FaDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth/refresh',
};

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('ab_token', accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie('ab_refresh', refreshToken, REFRESH_COOKIE_OPTIONS);
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Public Routes ─────────────────────────────────────────────────────────

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Register new user — sends email verification OTP' })
  @ApiResponse({ status: 201, description: 'User created, OTP sent to email' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register-gym')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Self-register a gym + admin account' })
  registerGym(@Body() dto: RegisterGymDto) {
    return this.authService.registerGym(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with OTP — sets httpOnly auth cookie on success' })
  @ApiResponse({ status: 200, description: 'Email verified, auth cookie set' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyEmail(dto);
    const { accessToken, refreshToken, tokenType, expiresIn, ...rest } = result as any;
    setAuthCookies(res, accessToken, refreshToken);
    return rest;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 1000, limit: 2 }, medium: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Login — sets httpOnly auth cookie on success' })
  @ApiResponse({ status: 200, description: 'Login successful, auth cookie set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or email not verified' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    const { accessToken, refreshToken, tokenType, expiresIn, ...rest } = result as any;
    setAuthCookies(res, accessToken, refreshToken);
    return rest;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using httpOnly refresh cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req.cookies as any)?.ab_refresh;
    const result = await this.authService.refreshTokens(refreshToken);
    const { accessToken, refreshToken: newRefresh } = result as any;
    setAuthCookies(res, accessToken, newRefresh);
    return { message: 'Token refreshed' };
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Resend OTP — rate limited to 3/min per IP' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email, dto.purpose);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 1000, limit: 1 }, medium: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Request password reset OTP' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid/expired OTP' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ─── Protected Routes ──────────────────────────────────────────────────────

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Get('socket-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Short-lived token for the Socket.io handshake (httpOnly cookie cannot reach a cross-domain socket origin)' })
  getSocketToken(@CurrentUser() user: any) {
    return this.authService.issueSocketToken(user.id, user.email, user.role);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (requires current password) — invalidates current session' })
  changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto, user.jti);
  }

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: send email OTP to a prospective member email' })
  sendOtp(@Body() body: { email: string; name?: string }) {
    return this.authService.sendEmailOtp(body.email, body.name);
  }

  @Post('otp/check')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: verify email OTP' })
  checkOtp(@Body() body: { email: string; otp: string }) {
    return this.authService.checkEmailOtp(body.email, body.otp);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — revokes the current token and clears auth cookie' })
  logout(@CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('ab_token', { path: '/' });
    res.clearCookie('ab_refresh', { path: '/api/v1/auth/refresh' });
    return this.authService.logout(user.jti, user.id);
  }
}

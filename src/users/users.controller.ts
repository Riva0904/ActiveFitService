import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Create user (admin creates member, super admin creates admin)' })
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.usersService.createUser(body, user.role, user.gymId);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Get all users' })
  findAll(@Query() query: any, @CurrentUser() user: any) {
    const gymId = user.role === Role.GYM_ADMIN ? user.gymId : query.gymId;
    return this.usersService.findAll(query, gymId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  getMe(@CurrentUser('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get('stats')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get member stats' })
  getStats(@CurrentUser() user: any, @Query('gymId') gymId: string) {
    return this.usersService.getMemberStats(user.role === Role.GYM_ADMIN ? user.gymId : gymId);
  }

  @Get('stats/growth')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get member growth over last 6 months' })
  getGrowth(@CurrentUser() user: any, @Query('gymId') gymId: string) {
    return this.usersService.getMemberGrowth(user.role === Role.GYM_ADMIN ? user.gymId : gymId);
  }

  @Get('at-risk')
  @Roles(Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Get members with active membership who have not checked in recently' })
  getAtRisk(
    @CurrentUser() user: any,
    @Query('days', new DefaultValuePipe(14), ParseIntPipe) days: number,
  ) {
    return this.usersService.getAtRiskMembers(user.gymId, days);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (role, gymId, isActive etc. are ignored)' })
  updateMe(@CurrentUser('id') id: string, @Body() body: any) {
    return this.usersService.updateOwnProfile(id, body);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }

  @Patch(':id/deactivate')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Deactivate user' })
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Patch(':id/activate')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Activate user' })
  activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Permanently delete user' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/send-winback')
  @Roles(Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Send a win-back email and notification to a member' })
  sendWinback(@Param('id') memberId: string, @CurrentUser() user: any) {
    return this.usersService.sendWinbackMessage(memberId, user.gymId);
  }
}

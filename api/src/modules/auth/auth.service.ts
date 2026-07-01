import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ access_token: string }> {
    const existing = await this.prisma.account.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    if (existing) {
      if (existing.email === dto.email) throw new ConflictException('Email already in use');
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const account = await this.prisma.account.create({
      data: { email: dto.email, username: dto.username, passwordHash },
    });

    return { access_token: this.generateToken(account) };
  }

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const account = await this.prisma.account.findUnique({
      where: { email: dto.email },
    });

    if (!account) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, account.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return { access_token: this.generateToken(account) };
  }

  private generateToken(account: { id: string; username: string }): string {
    return this.jwt.sign({ sub: account.id, username: account.username });
  }
}

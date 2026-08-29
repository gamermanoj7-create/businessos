import { ApiProperty } from '@nestjs/swagger';

class AuthUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
}

class AuthBusinessDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
}

// Response shape for register/login/refresh. Deliberately excludes
// passwordHash, refresh token secrets, and any internal session details.
export class AuthResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty() expiresIn!: string;
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
  @ApiProperty({ type: AuthBusinessDto, required: false }) business?: AuthBusinessDto;
}

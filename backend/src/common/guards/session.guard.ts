import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UsersService } from "../../users/users.service";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const profileId: string | undefined = req.signedCookies?.profile_session;
    if (!profileId) {
      throw new UnauthorizedException("No active profile session");
    }
    const profile = await this.usersService.findById(profileId);
    if (!profile) {
      throw new UnauthorizedException("Profile not found");
    }
    req.user = { id: profileId };
    return true;
  }
}

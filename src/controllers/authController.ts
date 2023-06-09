import { Request, Response } from 'express';
import AuthService from '../service/authService';

class AuthController {
  login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    try {
      const data = await AuthService.login(email, password);
      res.status(200).json({ ...data });
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Invalid credentials' });
    }
  };

  register = async (req: Request, res: Response): Promise<void> => {
    const { name, email, password } = req.body;

    try {
      const data = await AuthService.register(name, email, password);
      res.status(201).json({ message: 'User created successfully', ...data });
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      }
    }
  };
}

export default new AuthController();

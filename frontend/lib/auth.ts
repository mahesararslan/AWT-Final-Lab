import { cookies } from 'next/headers';
import { authAPI } from './api';

export async function getServerUser() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken');
    
    if (!accessToken) {
      return null;
    }

    const response = await authAPI.getProfile();
    
    if (response.success && response.data?.user) {
      return response.data.user;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

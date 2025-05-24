// pages/api/get-facebook-pages.js
import { getToken } from "next-auth/jwt";
import axios from "axios";

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const token = await getToken({ req, secret });

  if (!token || !token.accessToken) {
    return res.status(401).json({ message: 'Not authenticated or no access token.' });
  }

  try {
    // Lấy danh sách các Fanpage mà người dùng quản lý
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/me/accounts`, // Sử dụng v19.0 hoặc phiên bản mới nhất
      {
        params: {
          access_token: token.accessToken,
          fields: 'id,name,picture,access_token' // RẤT QUAN TRỌNG: Yêu cầu page access token
        }
      }
    );

    const pages = response.data.data.map(page => ({
      id: page.id,
      name: page.name,
      picture: page.picture?.data?.url,
      // KHÔNG TRUYỀN access_token CỦA PAGE RA FRONTEND ĐỂ BẢO MẬT
      // Chúng ta chỉ cần ID và Tên. Page access token sẽ được lấy lại ở post-to-facebook API
    }));

    return res.status(200).json({ pages });

  } catch (error) {
    console.error('Error fetching Facebook pages:', error.response ? error.response.data : error.message);
    return res.status(error.response?.status || 500).json({
      message: 'Failed to fetch Facebook pages.',
      error: error.response ? error.response.data : error.message
    });
  }
}
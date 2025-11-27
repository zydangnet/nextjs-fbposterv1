import { getToken } from "next-auth/jwt";
import axios from "axios";

const secret = process.env.NEXTAUTH_SECRET;
const API_VERSION = 'v24.0'; 

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { pageId } = req.query; // Nhận pageId từ query parameter
  const token = await getToken({ req, secret }); 

  if (!token || !token.accessToken) {
    return res.status(401).json({ message: 'Not authenticated or no user access token.' });
  }

  if (!pageId) {
    return res.status(400).json({ message: 'Missing required field: pageId.' });
  }

  try {
    // Bước 1: Lấy Page Access Token
    // Cần User Access Token để lấy Page Access Token của Fanpage đã chọn
    const accountsResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/me/accounts`, 
      {
        params: {
          access_token: token.accessToken,
          fields: 'id,access_token'
        }
      }
    );

    const page = accountsResponse.data.data.find(p => p.id === pageId);
    const pageAccessToken = page?.access_token;

    if (!pageAccessToken) {
        return res.status(400).json({ 
            message: `Could not find access token for selected page ID: ${pageId}. Make sure your app has sufficient permissions.` 
        });
    }

    // Bước 2: Truy vấn 6 bài viết mới nhất
    // Endpoint: /{page-id}/posts
    const endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/posts`;
    
    const params = {
        // Lấy các trường thông tin quan trọng
        fields: 'id,message,created_time,full_picture,permalink_url,shares,comments.summary(true),reactions.summary(true)',
        limit: 6, // Giới hạn 6 bài
        access_token: pageAccessToken, // Cần Page Access Token
    };
    
    const postsResponse = await axios.get(endpoint, { params });
    
    // Trích xuất dữ liệu bài viết
    const latestPosts = postsResponse.data.data.map(post => ({
        id: post.id,
        permalink_url: post.permalink_url,
        message: post.message ? post.message.substring(0, 100) + (post.message.length > 100 ? '...' : '') : '[Không có nội dung]',
        created_time: post.created_time,
        picture: post.full_picture,
        reactions_count: post.reactions?.summary?.total_count || 0,
        comments_count: post.comments?.summary?.total_count || 0,
        shares_count: post.shares?.count || 0,
    }));

    return res.status(200).json({
      message: 'Successfully fetched latest posts.',
      posts: latestPosts,
    });

  } catch (apiError) {
    console.error('Error fetching latest posts:', apiError.response ? apiError.response.data : apiError.message);
    return res.status(apiError.response?.status || 500).json({
      message: 'Failed to fetch latest posts from Facebook.',
      error: apiError.response ? apiError.response.data : apiError.message,
    });
  }
}
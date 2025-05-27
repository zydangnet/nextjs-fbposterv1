// pages/api/post-to-facebook.js
import { getToken } from "next-auth/jwt";
import axios from "axios";

const secret = process.env.NEXTAUTH_SECRET; // Sử dụng SECRET từ .env.local

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { imageUrl, caption, pageIds } = req.body; // pageIds là MẢNG
  const token = await getToken({ req, secret }); // Lấy JWT (chứa user access token)

  if (!token || !token.accessToken) {
    return res.status(401).json({ message: 'Not authenticated or no user access token.' });
  }

  // --- Bắt đầu kiểm tra dữ liệu đầu vào ---
  if (!pageIds || pageIds.length === 0) {
    return res.status(400).json({ message: 'No Facebook Fanpages selected.' });
  }
  if (!imageUrl?.trim() && (!caption || caption.trim() === '')) {
    return res.status(400).json({ message: 'Please provide an image URL or a caption for your post.' });
  }
  // --- Kết thúc kiểm tra dữ liệu đầu vào ---

  const results = [];
  let fetchedPageAccessTokens = {};

  try {
    // Bước 1: Lấy tất cả Page Access Tokens của các Page mà người dùng quản lý
    // Chúng ta cần làm điều này một lần để tránh gọi API nhiều lần trong vòng lặp
    const accountsResponse = await axios.get(
      `https://graph.facebook.com/v19.0/me/accounts`, // Sử dụng v19.0 hoặc phiên bản mới nhất
      {
        params: {
          access_token: token.accessToken, // Đây là access token của người dùng
          fields: 'id,access_token' // Chỉ cần ID và access_token của Page
        }
      }
    );

    accountsResponse.data.data.forEach(page => {
      fetchedPageAccessTokens[page.id] = page.access_token;
    });

    // Bước 2: Lặp qua từng Page đã chọn và đăng bài
    for (const pageId of pageIds) {
      const pageAccessToken = fetchedPageAccessTokens[pageId];

      if (!pageAccessToken) {
        results.push({
          pageId,
          status: 'failed',
          message: `Could not find access token for page ${pageId}. Make sure your app has 'pages_manage_posts' permission for this page.`,
        });
        continue; // Bỏ qua trang này và tiếp tục với trang khác
      }

      const postParams = {
        access_token: pageAccessToken, // Đây là PAGE access token
      };

      let facebookApiEndpoint = '';
      let postType = '';

      if (imageUrl && imageUrl.trim() !== '') {
        // Đăng ảnh
        facebookApiEndpoint = `https://graph.facebook.com/v22.0/${pageId}/photos`;
        postParams.url = imageUrl.trim();
        postParams.caption = caption || ''; // Caption cho ảnh
        postParams.published = true;
        postType = 'photo';
      } else {
        // Đăng bài viết (status update)
        facebookApiEndpoint = `https://graph.facebook.com/v22.0/${pageId}/feed`;
        postParams.message = caption || ''; // Message cho bài viết
        postType = 'text';
      }

      try {
        console.log(`Attempting to post to Page ID: ${pageId} (${postType} post)`);
        const response = await axios.post(
          facebookApiEndpoint,
          postParams
        );

        results.push({
          pageId,
          status: 'success',
          //data: response.data,
          //endpoint: facebookApiEndpoint,
        });
      } catch (pagePostError) {
        console.error(`Error posting to Page ID ${pageId}:`, pagePostError.response ? pagePostError.response.data : pagePostError.message);
        results.push({
          pageId,
          status: 'failed',
          message: pagePostError.response ? pagePostError.response.data : pagePostError.message,
          details: pagePostError.response?.data,
        });
      }
    }

    const allSucceeded = results.every(r => r.status === 'success');
    if (allSucceeded) {
      return res.status(200).json({
        message: 'Posts successful on all selected pages!',
        results,
      });
    } else {
      return res.status(207).json({ // 207 Multi-Status
        message: 'Some posts succeeded, others failed. Check results for details.',
        results,
      });
    }

  } catch (apiError) {
    console.error('Error in Facebook post process:', apiError.response ? apiError.response.data : apiError.message);
    return res.status(apiError.response?.status || 500).json({
      message: 'Failed to process post request.',
      error: apiError.response ? apiError.response.data : apiError.message,
      details: apiError.response?.data,
    });
  }
}
import { getToken } from "next-auth/jwt";
import axios from "axios";

const secret = process.env.NEXTAUTH_SECRET;
const API_VERSION = 'v24.0'; 

// Hàm trích xuất Post ID (dạng số hoặc PFBID) từ URL hoặc chuỗi ID
function extractPostId(urlOrId) {
    const trimmed = urlOrId.trim();
    
    // 1. Nếu là chuỗi số hoặc PFBID (đã là ID hợp lệ)
    if (!trimmed.includes('facebook.com') && !trimmed.includes('fb.watch') && !trimmed.includes('fb.com')) {
        return trimmed; 
    }
    
    // 2. Phân tích URL
    
    // Match PFBID (sau /posts/)
    let match = trimmed.match(/\/posts\/(pfbid[a-zA-Z0-9]+)/);
    if (match) return match[1];

    // Match ID số truyền thống (sau /posts/)
    match = trimmed.match(/\/posts\/(\d+)/);
    if (match) return match[1];
    
    // Match ID số từ fbid (ví dụ: fbid=12345)
    match = trimmed.match(/fbid=(\d+)/);
    if (match) return match[1];
    
    // Match ID số trong URL chia sẻ cũ (permalink)
    match = trimmed.match(/permalink\/(\d+)/); 
    if (match) return match[1];
    
    // Match ID số từ video watch URL
    match = trimmed.match(/watch\/\?v=(\d+)/); 
    if (match) return match[1];

    // Mặc định trả về chuỗi gốc (để Facebook API tự xử lý nếu nó là ID hợp lệ, hoặc là một URL rút gọn)
    return trimmed; 
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // THAY ĐỔI: Nhận postUrl thay vì postId
  const { pageId, postUrl, commentContent } = req.body; 
  const token = await getToken({ req, secret }); 

  if (!token || !token.accessToken) {
    return res.status(401).json({ message: 'Not authenticated or no user access token.' });
  }

  // --- Kiểm tra dữ liệu đầu vào ---
  const finalPostId = extractPostId(postUrl); 

  if (!pageId || !finalPostId || commentContent.trim() === '') {
    return res.status(400).json({ 
        message: 'Missing required fields: pageId, Post ID (from URL), or commentContent.' 
    });
  }
  // --- Kết thúc kiểm tra dữ liệu đầu vào ---

  try {
    // Bước 1: Lấy Page Access Token
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
            message: `Could not find access token for selected page ID: ${pageId}. Make sure your app has sufficient permissions (pages_manage_posts).` 
        });
    }

    // Bước 2: Gọi API để thêm bình luận
    // Endpoint: /{post-id}/comments
    const endpoint = `https://graph.facebook.com/${API_VERSION}/${finalPostId}/comments`;
    
    const params = {
        message: commentContent.trim(),
        access_token: pageAccessToken,
    };
    
    console.log(`Attempting to add comment to Post ID: ${finalPostId} on Page ID: ${pageId}`);

    const response = await axios.post(endpoint, null, { params });
    
    // Facebook trả về ID của comment mới được tạo
    return res.status(200).json({
      message: 'Comment added successfully.',
      commentId: response.data.id,
      postResponse: response.data,
    });

  } catch (apiError) {
    console.error('Error adding comment:', apiError.response ? apiError.response.data : apiError.message);
    return res.status(apiError.response?.status || 500).json({
      message: 'Failed to add comment to post.',
      error: apiError.response ? apiError.response.data : apiError.message,
      details: apiError.response?.data,
    });
  }
}
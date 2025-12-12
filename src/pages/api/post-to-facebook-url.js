// src/pages/api/post-to-facebook-url.js - Dành riêng cho JSON (URL)
import { getToken } from "next-auth/jwt";
import axios from "axios";
import { splitAndCleanString, shuffleArray } from 'utils/functions';

const secret = process.env.NEXTAUTH_SECRET;
//const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;
const API_VERSION = 'v24.0';

// === THÊM MỚI: Hàm đăng bình luận ===
const postComment = async (postId, pageAccessToken, message) => {
    if (!message || message.trim() === '') return;

    const endpoint = `https://graph.facebook.com/${API_VERSION}/${postId}/comments`;
    const params = {
        message: message.trim(),
        access_token: pageAccessToken,
    };

    const response = await axios.post(endpoint, null, { params });
    return response.data; // Trả về { id: "comment_id" }
};

// Hàm dùng chung để đăng bài lên một Page cụ thể
const postToPage = async (pageId, pageAccessToken, postData) => {
    const { caption, imageUrls, scheduleDate } = postData;
    const scheduledParams = {};
    let postMode = "LIVE"; // Mặc định là đăng ngay
    let pageMessage = '';
    /* if (scheduleDate) {
        try {
            const scheduleTime = new Date(scheduleDate);
            const now = new Date();
            // Facebook yêu cầu thời gian phải tối thiểu 10 phút trong tương lai (600000 ms)
            const minFutureTime = new Date(now.getTime() + 10 * 60 * 1000); 
            if (scheduleTime > minFutureTime) {
                // Chuyển sang UNIX Timestamp (giây)
                const unixTimestamp = Math.floor(scheduleTime.getTime() / 1000);
                scheduledParams.scheduled_publish_time = unixTimestamp;
                // Đặt published=false để bài viết trở thành draft và đăng theo lịch
                scheduledParams.published = false; 
                postMode = "SCHEDULED";
                pageMessage =`[SCHEDULER] Page ${pageId} is set at: ${scheduleTime.toISOString()}`;
                console.log(pageMessage);
            } else {
                // Nếu lịch hẹn quá gần hoặc đã qua, đăng ngay
                pageMessage = `[SCHEDULER] Schedule time for Page ${pageId} is too short or invalid => Posting immediately.`;
                console.warn(pageMessage);
            }
        } catch (e) {
            pageMessage = `[SCHEDULER] Invalid schedule date format. Posting immediately: ${e.message}`;
            console.error('[SCHEDULER] Invalid schedule date format. Posting immediately:', e.message);
        }
    } */
    const sources = (imageUrls || []).filter(url => url.trim() !== '');
    if (sources.length === 0) {
        // TRƯỜNG HỢP 0 ẢNH HOẶC CHỈ CÓ TEXT
        const endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/feed`;
        const params = {
            message: caption || '',
            access_token: pageAccessToken,
            ...scheduledParams,
        };
        const response = await axios.post(endpoint, null, { params });
        return {responseData:response.data, postMode, pageMessage};
    }

    // TRƯỜNG HỢP 1 ẢNH 
    if (sources.length === 1) {
        const endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`;
        const params = {
            url: sources[0],
            caption: caption || '',
            access_token: pageAccessToken,
            published: true,
            ...scheduledParams, 
        };
        const response = await axios.post(endpoint, null, { params });
        return {responseData:response.data, postMode, pageMessage};
    }

    // TRƯỜNG HỢP 2-5 ẢNH (Multi-Photo)
    if (sources.length > 1 && sources.length <= 8) {
        const mediaIds = [];
        
        // BƯỚC 1: Đăng từng ảnh với published: false để lấy Media IDs
        for (const source of sources) {
            const mediaResponse = await axios.post(
                `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`,
                null,
                { 
                    params: {
                        url: source,
                        published: false,
                        access_token: pageAccessToken,
                    }
                }
            );
            mediaIds.push(mediaResponse.data.id);
        }
        // BƯỚC 2: Tạo Attached Media parameters
        const attachedMediaParams = mediaIds.map(mediaId => ({
            media_fbid: mediaId 
        }));
        
        // BƯỚC 3: Đăng bài chính bằng endpoint /feed
        const endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/feed`;
        const params = {
            message: caption || '',
            access_token: pageAccessToken,
            attached_media: attachedMediaParams, 
            ...scheduledParams,
        };
        
        const response = await axios.post(endpoint, null, { params });
        return {responseData:response.data, postMode, pageMessage};
    }

    throw new Error('Số lượng hình ảnh không hợp lệ (hỗ trợ 1-5 ảnh).');
};

// Handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  const { selectedPageIds, caption, imageUrls, commentContent, scheduleDate } = req.body; 

  const postData = { 
      caption: caption,
      imageUrls: imageUrls.filter(url => url.trim() !== ''),
      scheduleDate
  };
  
  let access_token = ""
  if (req.body && req.body.accessToken) {
        access_token = req.body.accessToken;
    }
  else {
        // Nếu không khớp, kiểm tra xác thực người dùng (Frontend-to-Server)
        const token = await getToken({ req, secret });
        if (!token || !token.accessToken) {
            return res.status(401).json({ message: 'Not authenticated or missing internal secret.' });
        }
        access_token = token.accessToken;
    }
  
  const totalImages = postData.imageUrls.length;

  if (!selectedPageIds || selectedPageIds.length === 0) {
    return res.status(400).json({ message: 'No Facebook Fanpages selected.' });
  }
  if (totalImages === 0 && (!caption || caption.trim() === '')) {
    return res.status(400).json({ message: 'Please provide at least one image URL or a caption for your post.' });
  }
  if (totalImages > 8) {
      return res.status(400).json({ message: 'Maximum 5 images are allowed.' });
  }

  const results = [];
  let fetchedPageAccessTokens = {};

  try {
    // Bước 3: Lấy tất cả Page Access Tokens
    const accountsResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/me/accounts`, 
      {
        params: {
          access_token: access_token,
          fields: 'id,access_token'
        }
      }
    );

    accountsResponse.data.data.forEach(page => {
      fetchedPageAccessTokens[page.id] = page.access_token;
    });

    // Lặp qua từng Page đã chọn và đăng bài
    for (const pageId of selectedPageIds) {
      const pageAccessToken = fetchedPageAccessTokens[pageId];

      if (!pageAccessToken) {
        results.push({
          pageId,
          status: 'failed',
          message: `Could not find access token for page ${pageId}. Make sure your app has 'pages_manage_posts' permission for this page.`,
        });
        continue;
      }

      try {
        console.log(`## Attempting to post to Page-ID: ${pageId} (Mode: URL, Images: ${totalImages})`);
        
        const {responseData, postMode, pageMessage} = await postToPage(pageId, pageAccessToken, postData);
        const postId = responseData.id; // Lấy Post ID
        const postedComments = [];
        if(postMode === "LIVE" && commentContent)
        {
          let commentsToPost = commentContent ? splitAndCleanString(commentContent) : [];
          if(commentsToPost.length > 3)
            commentsToPost = shuffleArray(commentsToPost);
          
          if (postId && commentsToPost && commentsToPost.length > 0) {
              try {
                      for (const commentMessage of commentsToPost) {
                          try {
                              const commentResult = await postComment(postId, pageAccessToken, commentMessage);
                              postedComments.push({ message: commentMessage, commentId: commentResult.id, status: 'success' });
                              console.log(`----Posted comment [${commentResult.id}] on caption ${postId}`);
                          } catch (commentError) {
                              // Ghi log lỗi nhưng không làm thất bại bài đăng chính
                              const errorMessage = commentError.response?.data?.error?.message || commentError.message;
                              console.error(`[COMMENT FAILED] Post ID ${postId} on Page ${pageId}: ${errorMessage}`);
                              postedComments.push({ 
                                  message: commentMessage, 
                                  status: 'failed', 
                                  error: errorMessage
                              });
                          }
                      }
                  }
              catch (commentProcessError) {
                  console.error(`Error in comment posting process for Post ID ${postId} on Page ${pageId}:`, commentProcessError.response ? commentProcessError.response.data : commentProcessError.message);
              }
          }
        }
        results.push({
                pageId,
                postMode,
                message: pageMessage,
                status: 'success',
                postId: responseData.post_id ? responseData.post_id : responseData.id,
                comments: postedComments, // <-- TRẢ VỀ KẾT QUẢ BÌNH LUẬN
                });
        
      } catch (pagePostError) {
        console.error(`Error posting to Page ID ${pageId}:`, pagePostError.response ? pagePostError.response.data : pagePostError.message);
        results.push({
          pageId,
          status: 'failed',
          message: pagePostError.response ? (pagePostError.response.data.error.message || pagePostError.response.data.message) : pagePostError.message,
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
      return res.status(207).json({ 
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
// pages/api/post-to-facebook.js
import { getToken } from "next-auth/jwt";
import axios from "axios";
import formidable from 'formidable'; 
import fs from 'fs'; 
// SỬA LỖI: Dùng thư viện form-data chuẩn cho Node.js
import FormData from 'form-data'; 

const secret = process.env.NEXTAUTH_SECRET;
const API_VERSION = 'v24.0'; 

// CẤU HÌNH BẮT BUỘC: Vô hiệu hóa Body Parser của Next.js cho FormData
export const config = {
  api: {
    bodyParser: false,
  },
};

// Hàm xử lý parse FormData
const parseFormData = (req) => {
    return new Promise((resolve, reject) => {
        const form = formidable({ 
            multiples: true,
            maxFileSize: 5 * 1024 * 1024 // 5MB limit per file
        });
        
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);

            // DEBUG: Ghi log để kiểm tra Raw data từ Formidable (DEBUG)
            console.log('DEBUG: Raw fields from Formidable:', fields); 

            // Hàm hỗ trợ lấy giá trị đầu tiên từ trường (có thể là Array hoặc String)
            const getFirstValue = (field) => Array.isArray(field) ? field[0] : field;

            // FIX LỖI: Lấy giá trị từ key 'pageIds[]' do frontend gửi (Formidable nhận mảng)
            const rawPageIds = fields['pageIds[]'];
            
            // Xử lý pageIds: Đảm bảo luôn trả về mảng chuỗi ID hợp lệ
            let parsedPageIds = Array.isArray(rawPageIds) 
                                ? rawPageIds.filter(id => id && id.trim() !== '') 
                                : [rawPageIds].flat().filter(id => id && id.trim() !== '');

            // DEBUG: Ghi log để kiểm tra kết quả parsing
            console.log('DEBUG: Parsed pageIds sent to handler:', parsedPageIds);

            const data = {
                caption: getFirstValue(fields.caption),
                postMode: getFirstValue(fields.postMode),
                pageIds: parsedPageIds, // Sử dụng biến đã được xử lý
                // Lấy mảng files từ trường 'images'
                files: Array.isArray(files.images) ? files.images : (files.images ? [files.images] : [])
            };
            
            resolve(data);
        });
    });
};


/**
 * Hàm đăng bài lên một Page cụ thể
 * @param {string} pageId - ID Fanpage
 * @param {string} pageAccessToken - Access Token của Fanpage
 * @param {object} postData - Dữ liệu bài viết {caption, sources, postMode}
 * @returns {Promise<object>} - Kết quả đăng bài từ Facebook API
 */
const postToPage = async (pageId, pageAccessToken, postData) => {
    const { caption, sources, postMode } = postData;
    
    const isFileUpload = postMode === 'file';

    if (sources.length === 0) {
        // TRƯỜNG HỢP 0 ẢNH HOẶC CHỈ CÓ TEXT
        const endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/feed`;
        const params = {
            message: caption || '',
            access_token: pageAccessToken,
        };
        const response = await axios.post(endpoint, null, { params });
        return response.data;
    }

    // TRƯỜNG HỢP 1 ẢNH 
    if (sources.length === 1) {
        const endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`;
        
        if (isFileUpload) {
            // FIX LỖI: Đăng ảnh bằng file buffer sử dụng thư viện form-data
            const filePath = sources[0].filepath;
            const fileData = fs.readFileSync(filePath);
            
            const formData = new FormData(); 
            formData.append('message', caption || '');
            formData.append('access_token', pageAccessToken);
            formData.append('published', 'true');
            // Append buffer trực tiếp
            formData.append('source', fileData, {
                 filename: sources[0].originalFilename || 'upfile_1.jpg',
                 contentType: sources[0].mimetype
            }); 
            
            const response = await axios.post(endpoint, formData, {
                // FIX LỖI: Bắt buộc phải dùng form.getHeaders() để lấy Content-Type và boundary
                headers: formData.getHeaders(), 
                maxContentLength: Infinity, // Bỏ giới hạn mặc định
                maxBodyLength: Infinity,
            });
            return response.data;

        } else {
            // Đăng ảnh bằng URL (Không bị lỗi)
            const params = {
                url: sources[0],
                caption: caption || '',
                access_token: pageAccessToken,
                published: true,
            };
            const response = await axios.post(endpoint, null, { params });
            return response.data;
        }
    }

    // TRƯỜNG HỢP 2-5 ẢNH (Multi-Photo)
    if (sources.length > 1 && sources.length <= 8) {
        const mediaIds = [];
        
        // BƯỚC 1: Đăng từng ảnh với published: false để lấy Media IDs
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];

            let postConfig = {};
            
            if (isFileUpload) {
                // FIX LỖI: Xử lý File Upload trong vòng lặp (giống trường hợp 1 ảnh)
                const filePath = source.filepath;
                const fileData = fs.readFileSync(filePath);

                const formData = new FormData(); 
                formData.append('access_token', pageAccessToken);
                formData.append('published', 'false'); 
                // Append buffer trực tiếp
                formData.append('source', fileData, {
                     filename: source.originalFilename || `upfile_${i + 1}.jpg`,
                     contentType: source.mimetype
                }); 

                postConfig = {
                    url: `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`,
                    data: formData,
                    config: {
                         // FIX LỖI: Dùng form.getHeaders()
                         headers: formData.getHeaders(),
                         maxContentLength: Infinity,
                         maxBodyLength: Infinity,
                    }
                }
            } else {
                // Đăng ảnh bằng URL (Không bị lỗi)
                postConfig = {
                    url: `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`,
                    config: {
                        params: {
                            url: source,
                            published: false,
                            access_token: pageAccessToken,
                        }
                    }
                }
            }
            
            const mediaResponse = await axios.post(
                postConfig.url,
                postConfig.data || null,
                postConfig.config
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
        };
        
        const response = await axios.post(endpoint, null, { params });
        return response.data;
    }

    throw new Error('Số lượng hình ảnh không hợp lệ (hỗ trợ 1-5 ảnh).');
};


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // --- BƯỚC 1: Lấy dữ liệu từ FormData ---
  const { caption, pageIds, files, postMode } = await parseFormData(req);
  
  const sources = postMode === 'file' 
    ? files // Formidable file objects (có filepath)
    : [].flat().filter(url => url.trim() !== ''); // Nếu cần xử lý URL, nhưng API này chỉ cho file

  const postData = { 
      caption: caption,
      sources: sources,
      postMode: postMode
  };
  
  const token = await getToken({ req, secret });

  if (!token || !token.accessToken) {
    return res.status(401).json({ message: 'Not authenticated or no user access token.' });
  }
  
  const totalImages = postData.sources.length;

  // --- BƯỚC 2: Kiểm tra dữ liệu đầu vào ---
  if (!pageIds || pageIds.length === 0) {
    // Lỗi 400 được gửi khi không chọn Fanpage
    return res.status(400).json({ message: 'No Facebook Fanpages selected.' });
  }
  if (totalImages === 0 && (!caption || caption.trim() === '')) {
    return res.status(400).json({ message: 'Please provide at least one image file or a caption for your post.' });
  }
  if (totalImages > 8) {
      return res.status(400).json({ message: 'Maximum 5 images are allowed.' });
  }
  // --- Kết thúc kiểm tra dữ liệu đầu vào ---


  const results = [];
  let fetchedPageAccessTokens = {};

  try {
    // Bước 3: Lấy tất cả Page Access Tokens
    const accountsResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/me/accounts`, 
      {
        params: {
          access_token: token.accessToken,
          fields: 'id,access_token'
        }
      }
    );

    accountsResponse.data.data.forEach(page => {
      fetchedPageAccessTokens[page.id] = page.access_token;
    });

    // Bước 4: Lặp qua từng Page đã chọn và đăng bài
    for (const pageId of pageIds) {
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
        console.log(`Attempting to post to Page ID: ${pageId} (Mode: ${postMode}, Images: ${totalImages})`);
        
        const responseData = await postToPage(pageId, pageAccessToken, postData);
        
        results.push({
          pageId,
          status: 'success',
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
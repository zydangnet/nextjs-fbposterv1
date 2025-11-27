// pages/api/post-content-to-facebook.js (ĐIỀU PHỐI TÁI SỬ DỤNG)

import { getToken } from "next-auth/jwt";
import axios from "axios";
import fs from 'fs';
import path from 'path';
import FormData from 'form-data'; // Cần cho việc upload video
import { updateDraftPostInfo, addPostedIdToContent } from 'utils/prisma';

const secret = process.env.NEXTAUTH_SECRET;
const API_VERSION = 'v24.0';
const VIDEO_PATH_PREFIX = ""; // Cần khớp với cấu hình trong content-manager.js


/**
 * Đăng bình luận vào bài viết
 * @param {string} postId ID bài viết Facebook (pageId_postId)
 * @param {string} pageAccessToken Page Access Token
 * @param {string} message Nội dung bình luận
 * @returns {Promise<any>}
 */
const postCommentToPost = async (postId, pageAccessToken, message) => {
    const endpoint = `https://graph.facebook.com/${API_VERSION}/${postId}/comments`;
    const params = {
        message: message,
        access_token: pageAccessToken,
    };
    const response = await axios.post(endpoint, null, { params });
    return response.data; // Trả về { id: 'comment_id' }
};
/**
 * Tái sử dụng logic đăng bài với URL/Link/Text Only.
 * @param {string} pageId 
 * @param {string} pageAccessToken 
 * @param {{caption: string, imageUrls: string[], linkAffi?: string}} postData 
 * @returns {Promise<any>}
 */
const postToFacebookUrl = async (pageId, pageAccessToken, postData) => {
    const { caption, imageUrls, linkAffi } = postData;
    const sources = (imageUrls || []).filter(url => url.trim() !== '');

    // TRƯỜNG HỢP CHỈ CÓ TEXT (Bao gồm cả Link Affi)
    if (sources.length === 0) {
        const endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/feed`;
        const params = {
            message: caption || '',
            link: linkAffi || undefined, // Thêm link affili nếu có
            access_token: pageAccessToken,
        };
        const response = await axios.post(endpoint, null, { params });
        return response.data;
    }

    // TRƯỜNG HỢP CÓ ẢNH URL (1 ảnh: /photos, >1 ảnh: Album/Feed)
    if (sources.length === 1) {
        // Đăng 1 ảnh: Gửi lên /photos
        const endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`;
        const params = {
            url: sources[0],
            caption: (caption || '') + (linkAffi ? `\n\n${linkAffi}` : ''),
            access_token: pageAccessToken,
        };
        const response = await axios.post(endpoint, null, { params });
        return response.data;
    }

    // TRƯỜNG HỢP NHIỀU ẢNH (Album/Attached Media)
    if (sources.length > 1) {
        // 1. Tải lên từng ảnh một
        const photoIds = [];
        for (const url of sources) {
            const uploadEndpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`;
            const uploadResponse = await axios.post(uploadEndpoint, null, {
                params: {
                    url: url,
                    access_token: pageAccessToken,
                    published: 'false', // Tải lên nhưng chưa đăng
                }
            });
            photoIds.push(uploadResponse.data.id);
        }

        // 2. Tạo Post/Album từ các ID ảnh đã tải lên
        const feedEndpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/feed`;
        const postParams = {
            message: (caption || '') + (linkAffi ? `\n\n${linkAffi}` : ''),
            access_token: pageAccessToken,
        };

        // Gắn các ID ảnh vào attached_media
        for (let i = 0; i < photoIds.length; i++) {
            postParams[`attached_media[${i}]`] = JSON.stringify({ media_fbid: photoIds[i] });
        }
        
        const response = await axios.post(feedEndpoint, null, { params: postParams });
        return response.data;
    }
};
// --- post-video-to-facebook.js  ---
/**
 * @param {string} pageId 
 * @param {string} pageAccessToken 
 * @param {string} videoPath Đường dẫn tuyệt đối đến file video (ví dụ: D:\AffVideos\clip.mp4)
 * @param {string} caption 
 * @returns {Promise<any>}
 */
const postVideoFileToPage = async (pageId, pageAccessToken, videoPath, caption) => {
    const fullPath = videoPath; // Đường dẫn tuyệt đối đã được client hoặc scheduler truyền vào
    
    // Kiểm tra file tồn tại
    if (!fs.existsSync(fullPath)) {
        throw new Error(`Video file not found at path: ${fullPath}`);
    }

    // Mặc định là REELS nếu có path, hoặc nếu muốn có thể truyền thêm videoType vào body.
    const videoType = (fullPath.includes('.mp4') || fullPath.includes('.mov')) ? 'REELS' : 'NORMAL'; // Giả định
    const endpoint = `https://graph-video.facebook.com/${API_VERSION}/${pageId}/videos`;

    // Chuẩn bị FormData để tải file
    const form = new FormData();
    form.append('file_base64', fs.createReadStream(fullPath)); // Đính kèm file stream
    form.append('description', caption || '');
    form.append('access_token', pageAccessToken);
    
    // Nếu là Reels, thêm tham số is_reel
    if (videoType === 'REELS') {
        form.append('is_reel', 'true');
        // Đối với Reels, nên dùng endpoint /videos, và Facebook tự động xác định
    } else {
        // Có thể thêm title, is_crossposting_disabled, v.v. cho video thường
    }

    const response = await axios.post(endpoint, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
    });
    
    return response.data;
};
// --- KẾT THÚC post-video-to-facebook.js ---


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed.' });
    }

    const token = await getToken({ req, secret });
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated.' });
    }

    const { 
        id, // ID của record trong ZyPostfb (Content Manager)
        TargetPageIds: selectedPageIds, 
        MainContent: caption, 
        ImageUrls: imageUrlsRaw, 
        VideoPath,
        LinkAffi,
        Comment: contentComment,
        ...contentData
    } = req.body;
    
    
    const imageUrls = (imageUrlsRaw || []).filter(url => url && url.trim() !== '');

    if (!id || selectedPageIds.length === 0) {
        return res.status(400).json({ message: 'Missing Content ID or Page IDs.' });
    }

    const userAccessToken = token.accessToken;
    
    if (!userAccessToken) {
        return res.status(401).json({ message: 'Facebook access token not found.' });
    }

    // Bước 1: Lấy Page Access Token (Cần lấy từ Facebook API)
    let pageAccessTokens = {};
    try {
        const accountsResponse = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/me/accounts`,
            { params: { access_token: userAccessToken } }
        );
        accountsResponse.data.data.forEach(page => {
            pageAccessTokens[page.id] = page.access_token;
        });
    } catch (e) {
        console.error('Error fetching page access tokens:', e.response?.data || e.message);
        return res.status(500).json({ message: 'Failed to retrieve Facebook Page Access Tokens.' });
    }

    const results = [];
    
    // Bước 2: Lặp qua các Page và Đăng bài
    for (const pageId of selectedPageIds) {
        const pageAccessToken = pageAccessTokens[pageId];
        
        if (!pageAccessToken) {
            results.push({
                pageId,
                status: 'failed',
                message: `Could not find access token for Page ID: ${pageId}.`,
            });
            continue;
        }

        try {
            let responseData;

            // LOGIC ĐIỀU PHỐI (QUAN TRỌNG)
            if (VideoPath && VideoPath.trim() !== '') {
                // TRƯỜNG HỢP 1: CÓ VIDEO PATH -> GỌI HÀM ĐĂNG VIDEO FILE CỤC BỘ
                const fullVideoPath = path.join(VIDEO_PATH_PREFIX, VideoPath);
                console.log(`[Dispatch] Page ${pageId}: Posting Video File from: ${fullVideoPath}`);
                responseData = await postVideoFileToPage(pageId, pageAccessToken, fullVideoPath, caption);
            } else {
                // TRƯỜNG HỢP 2: KHÔNG CÓ VIDEO PATH -> GỌI HÀM ĐĂNG ẢNH URL/LINK/TEXT
                console.log(`[Dispatch] Page ${pageId}: Posting Photo URL / Link / Text.`);
                const postData = {
                    caption, 
                    imageUrls,
                    linkAffi: LinkAffi 
                };
                responseData = await postToFacebookUrl(pageId, pageAccessToken, postData);
            }
            // KẾT THÚC LOGIC ĐIỀU PHỐI
            const fullPostId = responseData.id || responseData.post_id;
            console.log(`Posted to Page ID ${pageId} successfully. Post ID: ${fullPostId}`);
            // Thêm kết quả thành công của bài post chính
            const pageResult = {
                pageId,
                status: 'success',
                postId: fullPostId,
                commentStatus: 'skipped', // Mặc định là bỏ qua (nếu không có contentComment)
            };
            results.push(pageResult);
            
            // Cập nhật IDFbPost và PostedDate vào Content Manager (chỉ cần 1 lần)
            if (fullPostId) {
                await updateDraftPostInfo(id, pageId, fullPostId);
            }
            // --- 2. LOGIC ĐĂNG BÌNH LUẬN (YÊU CẦU MỚI) ---
            if (fullPostId && contentComment && contentComment.trim()) {
                console.log(`Attempting to post comment to Post ID: ${fullPostId}`);
                
                try {
                    const commentResponse = await postCommentToPost(fullPostId, pageAccessToken, contentComment.trim());
                    const commentId = commentResponse.id;
                    
                    if (commentId) {
                        const postedId = `cmt_${commentId}`;
                        // Cập nhật Comment ID vào trường PostedIds
                        await addPostedIdToContent(id, postedId); 

                        console.log(`Comment posted successfully. Comment ID: ${commentId}. DB updated.`);
                        
                        // Cập nhật kết quả của Fanpage hiện tại
                        pageResult.commentStatus = 'success';
                        pageResult.commentId = commentId;
                    }

                } catch (commentError) {
                    const cmtErrMsg = commentError.response 
                        ? (commentError.response.data.error.message || commentError.response.data.message) 
                        : commentError.message;
                    
                    console.error(`Error posting comment to Post ID ${fullPostId}:`, cmtErrMsg, commentError.response?.data);
                    
                    // Ghi nhận lỗi comment (nhưng vẫn coi post chính thành công và tiếp tục vòng lặp)
                    pageResult.commentStatus = 'failed';
                    pageResult.commentMessage = `Lỗi Comment: ${cmtErrMsg}`;
                }
            }
            // --- KẾT THÚC LOGIC BÌNH LUẬN ---

        } catch (pagePostError) {
            const errorMessage = pagePostError.response 
                ? (pagePostError.response.data.error.message || pagePostError.response.data.message) 
                : pagePostError.message;

            console.error(`Error posting to Page ID ${pageId}:`, errorMessage, pagePostError.response?.data);
            results.push({
                pageId,
                status: 'failed',
                message: `Lỗi: ${errorMessage}`,
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
}
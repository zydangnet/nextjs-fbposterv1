import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSession, signIn, signOut } from "next-auth/react";
import Link from 'next/link';
import Header from '../components/Header';

// Dãy icons phổ biến theo yêu cầu của bạn
const commonIcons = [
  '👉', '📞', '☎️', '📱', '🔥', '💥', '✨', '🌟', '✅', '✔️', 
  '❌', '➡️', '⬅️', '💰', '🎁', '📦', '💯', '👍', '💪', '🏆',
];

export default function AddComment() {
  const { data: session } = useSession();
  
  const [facebookPages, setFacebookPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState(''); 
  const [postUrl, setPostUrl] = useState('');
  const [commentContent, setCommentContent] = useState('');
  
  const [latestPosts, setLatestPosts] = useState([]); // STATE: Danh sách bài viết
  const [loadingPosts, setLoadingPosts] = useState(false); // STATE: Loading bài viết
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Tải Fanpages (Giữ nguyên)
  useEffect(() => {
    const fetchPages = async () => {
      if (session) {
        try {
          const pagesRes = await axios.get('/api/get-facebook-pages');
          setFacebookPages(pagesRes.data.pages);
        } catch (err) {
          console.error('Error fetching FB-pages:', err);
          setError('Failed to load FB-pages: ' + (err.response?.data?.message || err.message));
        }
      }
    };
    fetchPages();
  }, [session]);
  
  // LOGIC: Tải bài viết khi Fanpage được chọn
  useEffect(() => {
    if (selectedPageId) {
        fetchLatestPosts(selectedPageId);
    } else {
        setLatestPosts([]); // Xóa danh sách bài viết khi không có page nào được chọn
    }
  }, [selectedPageId]);

  // HÀM: Gọi API lấy bài viết
  const fetchLatestPosts = async (pageId) => {
    setLoadingPosts(true);
    setLatestPosts([]);
    try {
        const postsRes = await axios.get(`/api/get-latest-posts?pageId=${pageId}`);
        setLatestPosts(postsRes.data.posts);
        setError('');
    } catch (err) {
        console.error('Error fetching latest posts:', err);
        setError('Không thể tải bài viết mới nhất: ' + (err.response?.data?.message || err.message));
    } finally {
        setLoadingPosts(false);
    }
  }

  const handleSubmitComment = async (event) => {
    event.preventDefault();

    const trimmedPostUrl = postUrl.trim();
    const trimmedComment = commentContent.trim();
    
    if (!selectedPageId) {
        setError('Vui lòng chọn một Fanpage.');
        return;
    }
    if (!trimmedPostUrl) {
        setError('Vui lòng nhập URL hoặc ID Bài viết.');
        return;
    }
    if (!trimmedComment) {
        setError('Vui lòng nhập nội dung bình luận.');
        return;
    }
    
    setLoading(true);
    setMessage('');
    setError('');

    try {
        const response = await axios.post(`/api/add-comment-to-post`, {
            pageId: selectedPageId,
            postUrl: trimmedPostUrl, 
            commentContent: trimmedComment,
        });
        
        setMessage(`Đã thêm bình luận thành công! Comment ID: ${response.data.commentId}`);
        setError('');
        // Sau khi comment thành công, làm mới danh sách bài viết
        fetchLatestPosts(selectedPageId); 
        
    } catch (err) {
      console.error('Lỗi khi gửi request thêm Comment:', err.response ? err.response.data : err.message);
      setError('Lỗi khi thêm Comment: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  // Hàm xử lý khi click vào icon
  const handleIconClick = (icon) => {
    setCommentContent(prev => prev + icon);
  }
  
  // HÀM: Điền ID bài viết
  const handlePostClick = (postId) => {
    setPostUrl(postId); 
    setCommentContent('');
    setMessage(`Đã chọn ID bài viết: ${postId}. Vui lòng nhập nội dung comment.`);
    // Không cuộn nữa để giữ vị trí người dùng ở form bên trái
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-4">Vui lòng đăng nhập</h1>
          <button
            onClick={() => signIn('facebook')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Đăng nhập với Facebook
          </button>
        </div>
      </div>
    );
  }
  
  const isFormInvalid = !selectedPageId || !postUrl.trim() || !commentContent.trim();

  return (
    <div className="min-h-screen bg-gray-100">
        
      <Header onSignOut={() => signOut()} userName={session.user.name} />

        {/* BỐ CỤC CHÍNH: 2 CỘT */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* CỘT TRÁI: FORM THÊM BÌNH LUẬN */}
            <div className="bg-white p-6 rounded-lg shadow-xl h-full">
                <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">1. Thông tin Comment</h2>
                <form onSubmit={handleSubmitComment} className="space-y-4">
                    
                    {/* Chọn Fanpage */}
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-1">Chọn Fanpage để đăng Comment:</label>
                        {facebookPages.length > 0 ? (
                            <select
                                value={selectedPageId}
                                onChange={(e) => setSelectedPageId(e.target.value)}
                                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                            >
                                <option value="">-- Chọn Fanpage --</option>
                                {facebookPages.map(page => (
                                    <option key={page.id} value={page.id}>
                                        {page.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-xs text-gray-500 italic">Đang tải Fanpage của bạn...</p>
                        )}
                    </div>

                    {/* URL / ID Bài viết */}
                    <div>
                        <label htmlFor="postUrl" className="block text-sm font-bold text-gray-800 mb-1">ID Bài viết:</label>
                        <input
                            id="postUrl"
                            type="text"
                            value={postUrl}
                            onChange={(e) => setPostUrl(e.target.value)}
                            placeholder="Dán ID bài viết (hoặc URL) vào đây. Ví dụ: 211571202307529_1423316586463636 hoặc pfbid..."
                            className="mt-0.5 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">Bạn có thể dán ID bài viết (dạng số hoặc PFBID) hoặc URL. Backend sẽ tự động trích xuất ID.</p>
                    </div>

                    {/* Nội dung Comment */}
                    <div>
                        <label htmlFor="commentContent" className="block text-sm font-bold text-gray-800 mb-1">Nội dung Comment:</label>
                        
                        {/* Dãy icon phổ biến */}
                        <div className="flex flex-wrap gap-1 mb-1">
                            {commonIcons.map((icon, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleIconClick(icon)}
                                    className="text-lg p-0.5 rounded-sm hover:bg-gray-200 transition"
                                    title={icon}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                        {/* Hết Dãy icon */}
                        
                        <textarea
                            id="commentContent"
                            value={commentContent}
                            onChange={(e) => setCommentContent(e.target.value)}
                            rows="8" 
                            placeholder="Nhập nội dung bình luận..."
                            className="mt-0.5 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm resize-y"
                        ></textarea>
                    </div>
                    
                    <button
                        type="submit"
                        disabled={loading || isFormInvalid}
                        className={`w-full py-2 px-4 rounded-md font-semibold text-white shadow-md transition duration-300 mt-4 ${
                          loading || isFormInvalid ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500'
                        }`}
                    >
                        {loading ? 'Đang thêm bình luận...' : 'Thêm Bình Luận'}
                    </button>
                </form>

                {message && (
                  <p className="mt-4 p-2 rounded-md bg-green-100 text-green-700 border border-green-200 text-sm">{message}</p>
                )}
                {error && (
                  <p className="mt-4 p-2 rounded-md bg-red-100 text-red-700 border border-red-200 text-sm">{error}</p>
                )}
            </div>

            {/* CỘT PHẢI: DANH SÁCH BÀI VIẾT */}
            <div className="bg-white p-6 rounded-lg shadow-xl h-full">
                <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Bài viết mới nhất</h2> {/* ĐÃ ĐỔI TÊN */}
                
                {selectedPageId ? (
                    loadingPosts ? (
                        <p className="text-center text-gray-500 py-4">Đang tải bài viết...</p>
                    ) : latestPosts.length > 0 ? (
                        // THAY ĐỔI CẤU TRÚC: Sử dụng grid 2 cột cho danh sách bài viết
                        <ul className="grid grid-cols-2 gap-4"> 
                            {latestPosts.map((post) => (
                                <li 
                                    key={post.id} 
                                    className="p-3 border rounded-lg shadow-sm hover:bg-gray-100 cursor-pointer transition duration-150"
                                    onClick={() => handlePostClick(post.id)} 
                                >
                                    <div className="flex flex-col h-full">
                                        {post.picture && (
                                            // Thêm aspect ratio để hình ảnh không bị biến dạng
                                            <div className="w-full pb-[56.25%] relative mb-2"> 
                                                <img 
                                                    src={post.picture} 
                                                    alt="Post thumbnail" 
                                                    className="absolute top-0 left-0 w-full h-full object-cover rounded"
                                                />
                                            </div>
                                        )}
                                        <div className="flex-grow min-w-0">
                                            <p className="text-xs text-gray-500 mb-1">{new Date(post.created_time).toLocaleString('vi-VN')}</p>
                                            <p className="text-sm font-semibold text-blue-600 line-clamp-2">
                                                {post.message}
                                            </p>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                            <p className="text-xs text-gray-600">
                                                <span className="mr-2">👍 {post.reactions_count}</span>
                                                <span className="mr-2">💬 {post.comments_count}</span>
                                                <span>🔗 {post.shares_count}</span>
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1 break-all">ID: {post.id}</p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-4">Không tìm thấy bài viết mới nào. Chọn Fanpage khác hoặc kiểm tra lại quyền.</p>
                    )
                ) : (
                    <p className="text-center text-gray-500 py-4">Vui lòng chọn Fanpage ở cột bên trái để tải danh sách bài viết.</p>
                )}
            </div>
            {/* KẾT THÚC CỘT PHẢI */}
            
        </div>
        {/* KẾT THÚC BỐ CỤC CHÍNH */}

    </div>
  );
}
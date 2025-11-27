// src/pages/upload.js - Dành riêng cho Đăng bài bằng File Upload
import { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { useSession, signIn, signOut } from "next-auth/react";
import Header from '../components/Header';

// Tải Emoji Picker (Client-side only)
const Picker = dynamic(
  () => import('@emoji-mart/react').then((mod) => mod.default),
  { ssr: false }
);

const commonIcons = [
  '👉', '📞', '☎️', '🔥', '💥', '✨', '🌟', '⚡', '🎉',
  '💖', '❤️', '✅', '✔️', '❌', '➡️', '⬅️', '⬆️', '⬇️',
  '💰', '🎁', '📦', '🚚', '🛵', '🏠', '🏪', '🛒', '🛍️',
  '💯', '👍', '👎', '💪', '🏆', '⏰', '⏱️', '📅', '🗓️',
  '📌', '📍', '💡', '🔔', '📣', '📢', '💬', '❓', '❗',
  '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⚫', '⚪', '🟢',
];

export default function Upload() {
  const { data: session } = useSession();
  
  // Chỉ sử dụng selectedFiles
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  const [postContent, setPostContent] = useState('');
  const [loadingPublish, setLoadingPublish] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);

  const [facebookPages, setFacebookPages] = useState([]);
  const [selectedPageIds, setSelectedPageIds] = useState([]);

  // Tải dữ liệu ban đầu
  useEffect(() => {
    const fetchData = async () => {
      if (session) {
        try {
          // Tải Fanpage
          const pagesRes = await axios.get('/api/get-facebook-pages');
          setFacebookPages(pagesRes.data.pages);
        } catch (err) {
          console.error('Error fetching FB-pages:', err.response ? err.response.data : err.message);
          setError('Failed to load FB-pages: ' + (err.response?.data?.message || err.message));
        }
      } else {
        setFacebookPages([]);
        setSelectedPageIds([]);
      }
    };
    fetchData();
  }, [session]);

  const handlePageCheckboxChange = (e) => {
    const pageId = e.target.value;
    if (e.target.checked) {
      setSelectedPageIds(prev => [...prev, pageId]);
    } else {
      setSelectedPageIds(prev => prev.filter(id => id !== pageId));
    }
  };

  const insertCharacterIntoTextarea = (charToInsert) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const newContent = postContent.substring(0, start) + charToInsert + postContent.substring(textarea.selectionEnd);
      setPostContent(newContent);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + charToInsert.length;
        textarea.focus();
      }, 0);
    }
  };

  const handleEmojiSelect = (emoji) => {
    insertCharacterIntoTextarea(emoji.native);
    setShowEmojiPicker(false);
  };

  const handleIconSelect = (icon) => {
    insertCharacterIntoTextarea(icon);
  };

  const handleFileSelect = (e) => {
    // Lưu ý: Files phải được giải phóng bộ nhớ khi không dùng nữa
    setSelectedFiles(Array.from(e.target.files).slice(0, 8)); 
  };
  
  // Xử lý preview file
  const filesToPreview = useMemo(() => {
    return selectedFiles.map(file => ({
        name: file.name,
        url: URL.createObjectURL(file) // Tạo URL tạm thời để hiển thị
    }));
  }, [selectedFiles]);

  const handlePublishPost = async (event) => {
    event.preventDefault();

    const finalCaption = postContent.trim();
    const filesToUpload = selectedFiles;
    const imagesToPostCount = filesToUpload.length;
    
    if (imagesToPostCount === 0 && !finalCaption) {
        setError('Vui lòng tải lên hình ảnh hoặc nhập nội dung bài viết để đăng.');
        return;
    }
    if (selectedPageIds.length === 0) {
        setError('Vui lòng chọn ít nhất một Fanpage để đăng bài.');
        return;
    }
    
    setLoadingPublish(true);
    setMessage('');
    setError('');

    try {
        // SỬ DỤNG FormData CHO FILE UPLOAD
        const formData = new FormData();
        formData.append('caption', finalCaption);
        
        // DÒNG CODE TRỌNG TÂM: Đảm bảo truyền mảng pageIds[] cho Backend
        selectedPageIds.forEach(id => formData.append('pageIds[]', id)); 
        
        filesToUpload.forEach((file) => {
            // Tên trường phải là 'images' để backend nhận
            formData.append(`images`, file, file.name);
        });
        formData.append('postMode', 'file'); // Báo cho API biết đây là file upload

        // GỌI API FILE UPLOAD (API cũ của bạn)
        const response = await axios.post(`/api/post-to-facebook`, formData, {
            headers: {
                // Axios tự động set boundary nếu Content-Type là multipart/form-data
                'Content-Type': 'multipart/form-data', 
            },
        });
        
        setMessage(`Đã gửi bài viết lên Facebook: ${JSON.stringify(response.data.results)}`);
        // Reset sau khi đăng thành công
        setSelectedFiles([]);
        setPostContent('');
        setSelectedPageIds([]);
        setError('');
        
    } catch (err) {
      console.error('Lỗi khi gửi request đăng Facebook:', err.response ? err.response.data : err.message);
      setError('Lỗi khi đăng bài lên Facebook: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingPublish(false);
      // Thu hồi URL tạo ra từ File API (quan trọng để tránh rò rỉ bộ nhớ)
      filesToPreview.forEach(file => URL.revokeObjectURL(file.url)); 
    }
  };

  const isPostEmpty = filesToPreview.length === 0 && postContent.trim() === '';
  
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-4 rounded-lg shadow-md text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-4">Vui lòng đăng nhập để sử dụng tính năng</h1>
          <button
            onClick={() => signIn('facebook')}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300"
          >
            Đăng nhập với Facebook
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      <Header onSignOut={() => signOut()} userName={session.user.name} />
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-xl">
        <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Đăng Bài Mới (Tải lên File)</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Cột 2: Nội dung Post và Button */}
          <div className="col-span-2 space-y-4">
            
            {/* KHỐI FILE UPLOAD */}
            <div className='border border-dashed border-gray-400 p-3 rounded-md bg-white'>
                <label htmlFor="file-upload" className="block text-sm font-bold text-gray-800 mb-2">
                    Tải ảnh từ máy tính/điện thoại (Tối đa 8 files)
                </label>
                <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept="image/jpeg, image/png, image/webp"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-50 file:text-blue-700
                                hover:file:bg-blue-100"
                />
                
                {filesToPreview.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 justify-start border p-2 rounded-md bg-blue-50">
                        <p className='text-xs text-blue-700 italic w-full mb-1 font-semibold'>Ảnh đã chọn ({filesToPreview.length} files):</p>
                        {filesToPreview.map((file, index) => (
                            <div key={index} className='relative w-16 h-16'>
                                <img 
                                    src={file.url} 
                                    alt={file.name} 
                                    className="w-full h-full object-cover rounded-md shadow-md border border-gray-300"
                                />
                                <span className='absolute bottom-0 right-0 bg-black bg-opacity-60 text-white text-xs px-1 rounded-tl-md max-w-full truncate' title={file.name}>
                                    {file.name.substring(0, 8)}...
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* KẾT THÚC KHỐI FILE UPLOAD */}


            <div className="relative">
              <label htmlFor="postContent" className="block text-sm font-medium text-gray-700 mb-1">Nội dung bài viết:</label>
              <textarea
                ref={textareaRef}
                id="postContent"
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows="12" 
                placeholder="Nhập nội dung bài viết..."
                className="mt-0.5 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm resize-y"
              ></textarea>
              
              <div className="mt-1 flex flex-wrap gap-0.5 p-0.5 bg-gray-50 border border-gray-200 rounded-md">
                {commonIcons.map((icon, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleIconSelect(icon)}
                    className="p-0.5 rounded-md text-sm bg-white border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition duration-200 leading-none"
                    title={`Chèn ${icon}`}
                  >
                    {icon}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-0.5 rounded-md text-sm bg-white border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition duration-200 leading-none"
                  title="Chèn Emoji"
                >
                  😊
                </button>
              </div>

              {showEmojiPicker && (
                <div className="absolute z-10 top-full mt-1 left-0 w-full md:w-auto shadow-lg rounded-md overflow-hidden">
                  <Picker onEmojiSelect={handleEmojiSelect} />
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              {/* Nút lưu đã bị loại bỏ ở trang này */}
              <button
                type="button"
                onClick={handlePublishPost}
                disabled={loadingPublish || isPostEmpty}
                className={`flex-1 py-1.5 px-3 rounded-md font-semibold text-white shadow-md transition duration-300 text-sm ${
                  loadingPublish || isPostEmpty ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75'
                }`}
              >
                {loadingPublish ? 'Đang đăng...' : 'Đăng lên Facebook'}
              </button>
            </div>
          </div>
            
          {/* Cột 3: Danh sách Fanpages */}
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">[Chọn Fanpage ({facebookPages.length}) [API-Graph]</label>
            {facebookPages.length > 0 ? (
              <div className="border border-gray-300 p-2 rounded-md h-full max-h-[480px] overflow-y-auto bg-gray-50"> 
                <ul className="space-y-1">
                {facebookPages.map(page => (
                  <li key={page.id} className="flex items-center mb-1 last:mb-0">
                    <input
                      type="checkbox"
                      id={`page-${page.id}`}
                      value={page.id}
                      checked={selectedPageIds.includes(page.id)}
                      onChange={handlePageCheckboxChange}
                      className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    {page.picture && <img src={page.picture} alt={page.name} className="w-6 h-6 rounded-full mr-2 ml-1 shadow-sm" />}
                    <label htmlFor={`page-${page.id}`} className="text-gray-900 font-medium cursor-pointer flex-grow hover:text-blue-700 text-sm">
                      {page.name}
                    </label>
                  </li>
                ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">Đang tải Fanpage của bạn hoặc không có Fanpage nào được tìm thấy. Đảm bảo ứng dụng Facebook của bạn có quyền pages_show_list.</p>
            )}
          </div>
        </div>

        {message && (
          <p className="mt-4 p-2 rounded-md bg-green-100 text-green-700 border border-green-200 text-sm">{message}</p>
        )}
        {error && (
          <p className="mt-4 p-2 rounded-md bg-red-100 text-red-700 border border-red-200 text-sm">{error}</p>
        )}
      </div>
    </div>
  );
}
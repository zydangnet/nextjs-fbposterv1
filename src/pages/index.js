// pages/index.js
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { useSession, signIn, signOut } from "next-auth/react";

const Picker = dynamic(
  () => import('@emoji-mart/react').then((mod) => mod.default),
  { ssr: false }
);

const commonIcons = [
  '👉', '📞', '☎️', '📱', '🔥', '💥', '✨', '🌟', '⚡', '🎉',
  '💖', '❤️', '✅', '✔️', '❌', '➡️', '⬅️', '⬆️', '⬇️',
  '💰', '🎁', '📦', '🚚', '🛵', '🏠', '🏪', '🛒', '🛍️',
  '💯', '👍', '👎', '💪', '🏆', '⏰', '⏱️', '📅', '🗓️',
  '📌', '📍', '🗺️', '💡', '🔔', '📣', '📢', '💬', '❓', '❗',
  '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⚫', '⚪', '🟨🟢',
];

export default function Home() {
  const { data: session } = useSession();

  const [imageUrl, setImageUrl] = useState('');
  const [postContent, setPostContent] = useState('');
  const [loadingPublish, setLoadingPublish] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);

  const [facebookPages, setFacebookPages] = useState([]);
  const [selectedPageIds, setSelectedPageIds] = useState([]);
  const [loadedEmojiData, setLoadedEmojiData] = useState(null);

  const [recentPosts, setRecentPosts] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@emoji-mart/data')
        .then((mod) => {
          setLoadedEmojiData(mod.default);
        })
        .catch(err => console.error("Failed to load emoji data:", err));
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setFacebookPages([]);
      setSelectedPageIds([]);
      setRecentPosts([]);
      if (session) {
        try {
          const postsRes = await axios.get('/api/get-recent-posts');
          setRecentPosts(postsRes.data.posts);

          const pagesRes = await axios.get('/api/get-facebook-pages');
          setFacebookPages(pagesRes.data.pages);

        } catch (err) {
          console.error('Error fetching data:', err.response ? err.response.data : err.message);
          setError('Failed to load data: ' + (err.response?.data?.message || err.message));
        }
      } else {
        setFacebookPages([]);
        setSelectedPageIds([]);
        setRecentPosts([]);
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
      const end = textarea.selectionEnd;
      const newContent = postContent.substring(0, start) + charToInsert + postContent.substring(end);
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

  const handleSavePost = async () => {
    const finalCaption = postContent.trim();
    const finalImageUrl = imageUrl.trim();

    if (!finalImageUrl && !finalCaption) {
        setError('Vui lòng cung cấp một URL hình ảnh hoặc nhập nội dung bài viết để lưu.');
        return;
    }

    setLoadingSave(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.post(`/api/save-post`, {
        imageUrl: finalImageUrl,
        caption: finalCaption,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      setMessage(`Bài viết đã được lưu vào database với ID: ${response.data.postId}`);
      setError('');
      setRecentPosts(prevPosts => {
        const newPost = {
            id: response.data.postId,
            createdAt: new Date().toISOString(),
            caption: finalCaption,
        };
        const updatedPosts = [newPost, ...prevPosts];
        return updatedPosts.slice(0, 10);
      });

    } catch (err) {
      console.error('Lỗi khi lưu bài viết:', err.response ? err.response.data : err.message);
      setError('Lỗi khi lưu bài viết: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingSave(false);
    }
  };

  const handlePublishPost = async (event) => {
    event.preventDefault();

    const finalCaption = postContent.trim();
    const finalImageUrl = imageUrl.trim();

    if (!finalImageUrl && !finalCaption) {
        setError('Vui lòng cung cấp một URL hình ảnh hoặc nhập nội dung bài viết để đăng.');
        return;
    }
    if (selectedPageIds.length === 0) {
        setError('Vui lòng chọn ít nhất một Fanpage để đăng bài.');
        return;
    }

    setLoadingPublish(true);
    setMessage('');
    setError('');

    const dataToSend = {
      imageUrl: finalImageUrl,
      caption: finalCaption,
      pageIds: selectedPageIds,
    };

    try {
      const response = await axios.post(`/api/post-to-facebook`, dataToSend, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      setMessage(`Đã gửi bài viết lên Facebook: ${JSON.stringify(response.data.results)}`);
      setImageUrl('');
      setPostContent('');
      setSelectedPageIds([]);
      setError('');
    } catch (err) {
      console.error('Lỗi khi gửi request đăng Facebook:', err.response ? err.response.data : err.message);
      setError('Lỗi khi đăng bài lên Facebook: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingPublish(false);
    }
  };

  const formatPostDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleLoadPost = (post) => {
    setImageUrl(post.imageUrl || '');
    setPostContent(post.caption || '');
    setMessage(`Đã tải bài viết "${post.caption?.substring(0, 30)}..." (ID: ${post.id})`);
    setError('');
  };


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
    <div className="min-h-screen bg-gray-100 py-2 px-2 sm:px-3 lg:px-4">
      <div className="max-w-7xl mx-auto bg-white p-4 rounded-lg shadow-xl">
        <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-200">
        
          <h1 className="text-2xl font-extrabold text-gray-900">Quản lý và Đăng bài lên FB-Fanpage của <i>{session.user.name}</i></h1>
          <button
            onClick={() => signOut()}
            className="px-3 py-1.5 bg-red-500 text-white font-medium rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transition duration-300"
          >
            Đăng xuất
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

          {/* Cột 1: Danh sách bài viết đã lưu - Chiếm 1/4 (25%) */}
          <div className="col-span-1">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Bài viết đã lưu gần đây</h2>
            {recentPosts.length > 0 ? (
              <div className="border border-gray-300 p-2 rounded-md h-full max-h-[480px] overflow-y-auto bg-gray-50"> {/* Điều chỉnh max-h */}
                <ul className="space-y-1">
                  {recentPosts.map(post => (
                    <li key={post.id}>
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); handleLoadPost(post); }}
                        className="block p-2 bg-white rounded-md shadow-sm hover:bg-blue-50 hover:text-blue-700 transition duration-200 cursor-pointer"
                      >
                        <p className="text-xs text-gray-500">{formatPostDate(post.createdAt)}</p>
                        <p className="text-gray-800 font-medium line-clamp-2 text-sm">{post.caption || 'Bài viết không có nội dung'}</p>
                        {post.imageUrl && (
                            <span className="text-xs text-blue-500 italic mt-0.5 block">Có ảnh</span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">Chưa có bài viết nào được lưu.</p>
            )}
          </div>

          {/* Cột 2: Nội dung Post và Button - Chiếm 2/4 (50%) */}
          <div className="col-span-2 space-y-4">
            <div>
              <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">URL hình ảnh (tùy chọn):</label>
              <input
                type="text"
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="E.g., https://example.com/your-image.jpg"
                className="mt-0.5 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              {imageUrl && (
                <div className="mt-2 flex justify-center">
                  <img src={imageUrl} alt="Preview" className="max-w-full max-h-48 object-contain rounded-md shadow-md border border-gray-200" />
                </div>
              )}
            </div>

            <div className="relative">
              <label htmlFor="postContent" className="block text-sm font-medium text-gray-700 mb-1">Nội dung bài viết:</label>
              <textarea
                ref={textareaRef}
                id="postContent"
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows="15" 
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

              {showEmojiPicker && loadedEmojiData && (
                <div className="absolute z-10 top-full mt-1 left-0 w-full md:w-auto shadow-lg rounded-md overflow-hidden">
                  <Picker data={loadedEmojiData} onEmojiSelect={handleEmojiSelect} />
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleSavePost}
                disabled={loadingSave || loadingPublish}
                className={`flex-1 py-1.5 px-3 rounded-md font-semibold text-white shadow-md transition duration-300 text-sm ${
                  loadingSave ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75'
                }`}
              >
                {loadingSave ? 'Đang lưu...' : 'Lưu bài viết'}
              </button>

              <button
                type="button"
                onClick={handlePublishPost}
                disabled={loadingPublish || loadingSave}
                className={`flex-1 py-1.5 px-3 rounded-md font-semibold text-white shadow-md transition duration-300 text-sm ${
                  loadingPublish ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75'
                }`}
              >
                {loadingPublish ? 'Đang đăng...' : 'Đăng lên Facebook'}
              </button>
            </div>
          </div>

          {/* Cột 3: Danh sách Fanpages - Chiếm 1/4 (25%) */}
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Fanpage để đăng bài:</label>
            {facebookPages.length > 0 ? (
              <div className="border border-gray-300 p-2 rounded-md h-full max-h-[480px] overflow-y-auto bg-gray-50"> {/* Điều chỉnh max-h */}
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
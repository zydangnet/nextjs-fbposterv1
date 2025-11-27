// pages/fanpage-manager.js

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSession, signOut } from "next-auth/react";
import Header from '../components/Header'; // Giả định có component Header
import { FaSyncAlt, FaSpinner, FaFacebook, FaTrash, FaCheckCircle, FaExclamationTriangle, FaListAlt } from 'react-icons/fa'; 

export default function FanpageManagerPage() {
    const { data: session, status } = useSession();
    
    // STATES CHO FANPAGE (Tải từ Database)
    const [facebookPages, setFacebookPages] = useState([]);
    const [loadingPages, setLoadingPages] = useState(true);
    const [isSyncingPages, setIsSyncingPages] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [fbPagesOnline, setFbPagesOnline] = useState('');

    // Hàm tải Pages từ Database
    const fetchFacebookPages = useCallback(async () => {
        setLoadingPages(true);
        setError('');
        try {
            // Gọi API /api/pages-db để lấy Pages đã lưu
            const pagesRes = await axios.get('/api/pages-db'); 
            setFacebookPages(pagesRes.data.pages);
            setMessage(prev => prev.includes('Đã đồng bộ') ? prev : 'Đã tải danh sách Fanpage từ Database.');
        } catch (err) {
            console.error('Error fetching FB-pages from DB:', err);
            setError('Lỗi khi tải Fanpage từ Database: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoadingPages(false);
        }
    }, []);

    // Hàm Đồng bộ Fanpage (Xóa cũ và Lưu mới)
    const syncFacebookPages = useCallback(async () => {
        if (isSyncingPages || status !== 'authenticated') return;
        
        setIsSyncingPages(true);
        setMessage('Đang đồng bộ Fanpage Facebook...');
        setError('');
        
        try {
            // Gọi API /api/sync-facebook-pages để XÓA CŨ VÀ LƯU MỚI DANH SÁCH PAGES
            const res = await axios.post('/api/sync-facebook-pages');
            
            if (res.data.success) {
                // Sau khi sync thành công, tải danh sách pages mới từ DB để hiển thị
                await fetchFacebookPages(); 
                setMessage(`Đã đồng bộ thành công ${res.data.count} Fanpage vào Database!`);
                setFbPagesOnline(res.data.apigraph || '');
            } else {
                setError(`Lỗi đồng bộ Fanpage: ${res.data.details}; ${res.data.message}. Vui lòng kiểm tra lại quyền truy cập Facebook.`);
            }
        } catch (err) {
            console.error('Error syncing FB-pages:', err);
            setError(`Lỗi kết nối khi đồng bộ Fanpage: ` + (err.response?.data?.message || err.message));
        } finally {
            setIsSyncingPages(false);
        }
    }, [status, isSyncingPages, fetchFacebookPages]);
    
    // Tải Fanpages lần đầu khi đăng nhập
    useEffect(() => {
        if (status === 'authenticated') {
            fetchFacebookPages();
        }
    }, [status, fetchFacebookPages]);

    if (status === 'loading') {
        return <div className="p-8 text-center text-gray-500 flex items-center justify-center min-h-screen"><FaSpinner className="animate-spin mr-2"/> Đang tải...</div>;
    }

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
    
    const username = session?.user?.name || 'User';

    return (
        <div className="min-h-screen bg-gray-100">
            <Header onSignOut={() => signOut()} userName={username} />
            <main className="py-2 px-4">
                <div className="max-w-4xl mx-auto bg-white p-2 rounded-lg shadow-xl">
                    
                    <div className="flex items-center mb-6 border-b pb-3">
                        <FaFacebook className="mr-3 text-blue-600" size={30} />
                        <h1 className="text-2xl font-extrabold text-gray-900">Danh sách Fanpages <i>của {username}</i></h1>
                    </div>

                    {/* HIỂN THỊ MESSAGE/ERROR */}
                    {isSyncingPages && (
                        <p className="p-3 mb-4 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200 text-sm flex items-center">
                            <FaSpinner className="animate-spin mr-2"/> {message}
                        </p>
                    )}
                    {message && !isSyncingPages && !error && (
                        <p className="p-3 mb-4 rounded-md bg-green-100 text-green-700 border border-green-200 text-sm flex items-center">
                            <FaCheckCircle className="mr-2"/> {message} ({facebookPages.length})
                            {fbPagesOnline && <span className='text-amber-500'>[Graph-api]={fbPagesOnline}</span>}
                        </p>
                    )}
                    {error && (
                        <p className="p-3 mb-4 rounded-md bg-red-100 text-red-700 border border-red-200 text-sm flex items-start">
                            <FaExclamationTriangle className="mr-2 mt-1 flex-shrink-0"/> {error}
                        </p>
                    )}
                    
                    {/* NÚT CẬP NHẬT MỚI FANPAGES */}
                    <button
                        onClick={syncFacebookPages}
                        disabled={isSyncingPages}
                        className={`flex items-center justify-center px-6 py-3 rounded-lg font-semibold shadow-md transition ${
                            isSyncingPages ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-blue-700 text-white'
                        } mb-6`}
                    >
                        {isSyncingPages ? (
                            <>
                                <FaSpinner className="animate-spin mr-2" /> Đang đồng bộ... (Xóa cũ & Lưu mới)
                            </>
                        ) : (
                            <>
                                <FaSyncAlt className="mr-2" /> Cập nhật mới Fanpages từ Facebook
                            </>
                        )}
                    </button>

                    {loadingPages && !isSyncingPages ? (
                        <p className="text-center py-10 text-gray-500 flex items-center justify-center"><FaSpinner className="animate-spin mr-2"/> Đang tải danh sách từ Database...</p>
                    ) : facebookPages.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <FaTrash size={30} className="mx-auto mb-3 text-gray-400"/>
                            <p>Không có Fanpage nào được tìm thấy trong Database.</p>
                            <p className="text-sm mt-1">Vui lòng nhấn nút **Cập nhật mới Fanpages** ở trên để đồng bộ.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border rounded-lg shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên Fanpage</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Page ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AccessToken</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {facebookPages.map((page) => (
                                        <tr key={page.id} className="hover:bg-blue-50/50">
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{page.name}</div>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                {page.id}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                <span className="font-mono text-xs text-green-600" title={page.accessToken}>
                                                    ...{page.accessToken ? page.accessToken.substring(page.accessToken.length - 8) : 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                                {page.category || 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
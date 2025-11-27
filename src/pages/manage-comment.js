// pages/manage-comment.js

import React, { useState, useEffect } from 'react'; 
import axios from 'axios';
import { useSession } from "next-auth/react";
import Header from '../components/Header'; 
import { FaPlus, FaTrash, FaEdit, FaTimes, FaSave, FaSpinner, FaComment } from 'react-icons/fa';

export default function ManageCommentPage() {
    const { data: session, status } = useSession();
    
    // States quản lý dữ liệu và UI
    const [comments, setComments] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentComment, setCurrentComment] = useState(null);
    const [formState, setFormState] = useState({
        name: '',
        content: '',
    });

    const API_ENDPOINT = '/api/comment-manager';

    // --- 1. FETCH DATA ---
    const fetchComments = async () => {
        if (status !== 'authenticated') return;

        try {
            const response = await axios.get(API_ENDPOINT);
            setComments(response.data.comments);
        } catch (error) {
            console.error('Error fetching comments:', error);
        }
    };

    useEffect(() => {
        if (status === 'authenticated') {
            fetchComments();
        }
    }, [status]);

    // --- 2. MODAL HANDLERS ---
    const openModal = (comment = null) => {
        if (comment) {
            setIsEditing(true);
            setCurrentComment(comment);
            setFormState({ name: comment.name, content: comment.content });
        } else {
            setIsEditing(false);
            setCurrentComment(null);
            setFormState({ name: '', content: '' }); // Reset form
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setIsEditing(false);
        setCurrentComment(null);
        setFormState({ name: '', content: '' });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    // --- 3. CRUD HANDLERS ---
    const handleSave = async (e) => {
        e.preventDefault();
        
        if (status !== 'authenticated') {
            alert('Bạn chưa đăng nhập hoặc phiên đã hết hạn.');
            return;
        }

        const method = isEditing ? 'PUT' : 'POST';
        const data = {
            ...formState,
            id: isEditing ? currentComment.id : undefined,
        };

        setIsSaving(true); 

        try {
            const response = await axios({
                method: method,
                url: API_ENDPOINT,
                data: data
            });

            alert(response.data.message);
            fetchComments(); 
            closeModal();

        } catch (error) {
            console.error('Lỗi khi lưu comment:', error.response?.data || error);
            alert(`Lỗi khi lưu: ${error.response?.data?.message || error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa mẫu comment "${name}"?`)) {
            return;
        }

        try {
            const response = await axios.delete(API_ENDPOINT, { data: { id } });
            alert(response.data.message);
            fetchComments(); 
        } catch (error) {
            console.error('Lỗi khi xóa comment:', error.response?.data || error);
            alert(`Lỗi khi xóa: ${error.response?.data?.message || error.message}`);
        }
    };

    if (status === 'loading') {
        return <Header><div className="flex justify-center items-center h-screen"><FaSpinner className="animate-spin mr-2"/> Đang tải...</div></Header>;
    }

    if (status !== 'authenticated') {
        return <Header><div className="text-center mt-10">Vui lòng đăng nhập để truy cập trang này.</div></Header>;
    }

    // --- 4. RENDER UI ---
    const username = session?.user?.name || 'User';
    return (
        <div className="min-h-screen bg-gray-100">
            <Header onSignOut={() => signOut()} userName={username} /> 
            <main className="container mx-auto p-4"><div className="max-w-6xl mx-auto bg-white p-1 rounded-lg shadow-xl">
                <div className="max-w-6xl flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                        <FaComment className="mr-2 text-indigo-600" /> Quản lý Comments
                    </h1>
                    <button 
                        onClick={() => openModal()} 
                        className="flex items-center px-4 py-2 bg-indigo-400 text-white rounded-md hover:bg-indigo-700 transition shadow-md"
                    >
                        <FaPlus className="mr-2" /> Thêm Mới
                    </button>
                </div>

                {/* Bảng Hiển Thị Comment */}
                <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên Mẫu</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">Nội Dung</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày Tạo</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Hành Động</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {comments.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500 italic">
                                        Chưa có mẫu comment nào.
                                    </td>
                                </tr>
                            ) : (
                                comments.map((comment) => (
                                    <tr key={comment.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{comment.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700 overflow-hidden max-h-20 break-words">{comment.content.substring(0, 150)}...</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(comment.CreatedDate).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            <button 
                                                onClick={() => openModal(comment)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-3 p-1"
                                                title="Chỉnh sửa"
                                            >
                                                <FaEdit />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(comment.id, comment.name)}
                                                className="text-red-600 hover:text-red-900 p-1"
                                                title="Xóa"
                                            >
                                                <FaTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div></main>

            {/* MODAL THÊM/SỬA COMMENT */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-2/3  p-6">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-xl font-semibold text-gray-900">
                                {isEditing ? 'Chỉnh Sửa Comment' : 'Thêm Mẫu Comment Mới'}
                            </h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <FaTimes size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSave}>
                            {/* Tên Mẫu */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Comment</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formState.name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    required
                                />
                            </div>

                            {/* Nội Dung Comment */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nội Dung Comment</label>
                                <textarea
                                    name="content"
                                    value={formState.content}
                                    onChange={handleChange}
                                    rows="8"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Nội dung comment..."
                                    required
                                />
                            </div>

                            {/* NÚT LƯU */}
                            <div className="flex justify-end space-x-2 pt-2 border-t">
                                <button 
                                    type="button" 
                                    onClick={closeModal} 
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition"
                                    disabled={isSaving} 
                                >
                                    <FaTimes className="inline-block mr-1"/> Hủy
                                </button>
                                <button 
                                    type="submit" 
                                    className={`flex items-center px-4 py-2 text-sm font-medium text-white rounded-md transition 
                                        ${isSaving 
                                            ? 'bg-gray-500 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-700'
                                        }`}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <FaSpinner className="animate-spin mr-2"/>
                                    ) : (
                                        <FaSave className="inline-block mr-1"/>
                                    )}
                                    {isEditing ? 'Lưu Thay Đổi' : 'Thêm Mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
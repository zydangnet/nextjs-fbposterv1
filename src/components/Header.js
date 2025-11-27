// components/Header.js

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useRef} from 'react';
import { FaChevronDown, FaPenFancy, FaListAlt } from 'react-icons/fa';

// Component con cho từng item trong menu
const NavLink = ({ href, children }) => {
    const router = useRouter();
    // Kiểm tra xem router.pathname có khớp chính xác với href hay không
    const isActive = router.pathname === href;
    
    return (
        <Link href={href} legacyBehavior>
            <a className={`px-3 py-1.5 rounded-md font-medium text-sm whitespace-nowrap transition duration-150 ${
                isActive 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-gray-700 hover:bg-gray-200'
            }`}>
                {children}
            </a>
        </Link>
    );
};

// Component cho Dropdown Menu
const DropdownMenu = ({ title, icon: Icon, links }) => {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef(null);

    // Kiểm tra xem bất kỳ link con nào có đang active hay không
    const isGroupActive = links.some(link => router.pathname === link.href);

    // Xóa bất kỳ timeout đóng nào đang chờ
    const clearTimeoutIfPending = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    // Mở menu và xóa timeout đóng nếu có
    const handleMouseEnter = () => {
        clearTimeoutIfPending();
        setIsOpen(true);
    };

    // Đặt timeout để đóng menu sau 200ms
    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 200); // 200ms là đủ để di chuyển chuột
    };

    return (
        <div 
            className="relative"
            onMouseEnter={handleMouseEnter} 
            onMouseLeave={handleMouseLeave}
        >
            {/* Nút chính */}
            <button 
                type="button" 
                className={`flex items-center px-4 py-2 rounded-md font-medium text-sm transition duration-350 ${
                    isGroupActive 
                        ? 'bg-indigo-900 text-white shadow-md' 
                        : 'text-gray-700 hover:bg-gray-200'
                }`}
                // Giữ nguyên trạng thái để không bị nhấp nháy khi hover
            >
                {Icon && <Icon className={`mr-2 ${isGroupActive ? 'text-white' : 'text-gray-500'}`} />}
                {title}
                <FaChevronDown className={`ml-2 h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>

            {/* Menu thả xuống */}
            {isOpen && (
                <div 
                    className="absolute z-10 mt-1 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 origin-top-right right-0"
                    role="menu" 
                    aria-orientation="vertical" 
                    aria-labelledby="menu-button"
                >
                    <div className="py-1" role="none">
                        {links.map((link) => (
                            <Link key={link.href} href={link.href} legacyBehavior>
                                <a className={`block px-4 py-2 text-sm ${
                                    router.pathname === link.href 
                                        ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                                        : 'text-gray-700 hover:bg-gray-100'
                                }`} role="menuitem">
                                    {link.label}
                                </a>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function Header({ onSignOut, userName }) {
    
    // 1. Gom nhóm Đăng bài viết
    const postLinks = [
        { href: '/', label: 'URL và Nhiều Ảnh' },
        { href: '/upload-image', label: 'Image Upload' },
        { href: '/upload-video', label: 'Video/Reels' },
        { href: '/add-comment', label: 'Thêm Bình Luận' },
        { href: '#', label: '-----------------------' },
        { href: '/scheduler-caption', label: 'Scheduler Caption' },
        { href: '/scheduler-video', label: 'Scheduler Video' },
    ];
    
    // 2. Gom nhóm Danh sách
    const listLinks = [
        { href: '/manage-zyposts', label: 'Quản lý ZyPostfb' },
        { href: '/manage-fanpage', label: 'Quản lý Fanpages' },
        { href: '/manage-comment', label: 'Quản Lý Comments' },
    ];

    return (
        <header className="bg-white shadow-md border-b border-gray-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                
                {/* Logo / Tên Ứng Dụng */}
                <Link href="/" legacyBehavior>
                    <a className="text-2xl font-bold text-gray-900 flex items-center hover:text-indigo-600 transition">
                        🚀 FBToolkit
                    </a>
                </Link>

                {/* Menu Điều Hướng (Gom nhóm) */}
                <nav className="flex items-center space-x-2">
                    
                    {/* Menu 1: Đăng bài viết */}
                    <DropdownMenu 
                        title="Đăng Bài Viết" 
                        icon={FaPenFancy} 
                        links={postLinks} 
                    />
                    
                    {/* Menu 2: Danh sách */}
                    <DropdownMenu 
                        title="Danh Sách" 
                        icon={FaListAlt} 
                        links={listLinks} 
                    />

                    {/* Link Scheduler (Nếu có) - giữ riêng nếu nó là 1 chức năng lớn */}
                    <NavLink href="/scheduler">Lên Lịch Tự Động</NavLink>
                    
                </nav>

                {/* Thông tin Người Dùng & Đăng xuất */}
                <div className="flex items-center space-x-3">
                    {userName && (
                        <span className="text-sm text-gray-600 hidden sm:inline font-medium">Chào, {userName}!</span>
                    )}
                    <button 
                        onClick={onSignOut} 
                        className="px-3 py-1.5 bg-gray-500 text-white rounded-md text-sm font-medium hover:bg-red-600 transition shadow-sm"
                    >
                        Đăng xuất
                    </button>
                </div>
            </div>
        </header>
    );
}

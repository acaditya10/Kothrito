import Image from 'next/image';

interface BrandingProps {
    role?: 'Admin' | 'Rider';
    onClick?: () => void;
}

export default function Branding({ role, onClick }: BrandingProps) {
    return (
        <div
            className={`flex items-center ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''} ${!role ? 'h-full py-3' : 'gap-1'}`}
            onClick={onClick}
        >
            {role ? (
                <div className="relative h-8 w-24">
                    <Image src="/logo.png" alt="Kothrito Logo" fill sizes="100px" className="object-contain object-left" priority />
                </div>
            ) : (
                <div className="relative h-8 w-32">
                    <Image src="/logo.png" alt="Kothrito Logo" fill sizes="128px" className="object-contain object-left" priority />
                </div>
            )}

            {role && (
                <span className={`text-[10px] text-white px-2 py-0.5 rounded-full font-black uppercase ${role === 'Rider' ? 'bg-slate-900 dark:bg-orange-600 tracking-tighter mt-1' : 'bg-slate-900'}`}>
                    {role}
                </span>
            )}
        </div>
    );
}

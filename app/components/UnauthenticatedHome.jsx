import { Tag, Box, RefreshCcw, ChartNoAxesColumnIncreasing, ShieldCheck } from 'lucide-react';

export const UnauthenticatedHome = ({ signInHandler }) => {
    const FEATURES = [
        {
            icon: <div className='bg-green-100 rounded-full p-2 w-max'><Tag color='#09A964' /></div>,
            name: 'Different Prices',
            content: 'Set market-specific pricing for each country.'
        },
        {
            icon: <div className='bg-blue-100 rounded-full p-2 w-max'><Box color='#106DFC' /></div>,
            name: 'Local Inventory',
            content: 'Manage stock levels independently, for every market.'
        },
        {
            icon: <div className='bg-green-100 rounded-full p-2 w-max'><RefreshCcw color='#09A964' /></div>,
            name: 'Keep everything in sync',
            content: 'Bi-Directional sync with Store through Google Sheets.'
        },
        {
            icon: <div className='bg-blue-100 rounded-full p-2 w-max'><ChartNoAxesColumnIncreasing color='#106DFC' /></div>,
            name: 'Scale Globally',
            content: 'Grow into new markets without the complexity'
        }
    ]
    return (
        <>
            <div className="bg-white px-4 py-4 rounded-md flex">
                <div className='flex-3'>
                    <p className="bg-blue-100 text-xs text-blue-700 border border-blue-700 w-max px-3 py-1 rounded-full">Get Started</p>
                    <h1 className='text-2xl font-bold pt-4'>Connect your Google Market</h1>
                    <p className='text-[14px] text-gray-400 py-2'>MarketMate uses Google Sheets to manage your product
                        pricing and inventory across multiple markets, all from one
                        spreadsheet.</p>
                    <button onClick={signInHandler} className='cursor-pointer mt-4 px-3 py-2 flex items-center gap-1 rounded-full border border-[#cbcbcb] hover:border-[#6d6d6d]'>
                        <img src='/g-icon.png' width={28} height={28} />
                        <span className='text-[12px] font-semibold'>Connect with Google</span>
                    </button>
                    <p className='flex items-center gap-2 pt-4'><ShieldCheck color='#3C3C3C' size={20} />We only access the spreadsheets you choose. Your data is safe and secure.</p>
                </div>
                <div className='flex-2'>
                    <img src="/hero-banner.png" />
                </div>
            </div>
            <div className='py-8'>
                <h2 className="text-xl font-bold my-4">Why use MarketMate?</h2>
                <div className="flex gap-4">
                    {FEATURES.map((feature) => (
                        <div className="bg-white px-4 py-3 rounded-md">
                            {feature.icon}
                            <h3 className="font-semibold text-[14px] py-1">{feature.name}</h3>
                            <p>{feature.content}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <img src="/banner-strip.png" />
            </div>
        </>
    );
};

export default UnauthenticatedHome;
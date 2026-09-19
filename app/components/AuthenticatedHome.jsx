import { DropdownMenu } from '@/components/ui/dropdown-menu.jsx'
import { Button } from '@/components/ui/button.jsx'
export const AuthenticatedHome = ({ googleAccount }) => {
    return (
        <div>
            <h1 className="text-2xl font-bold">Hi there!</h1>
            <p className="text-[14px] text-gray-400">Your store is connected and ready to manage multi-market inventory and pricing.</p>

            <div>
                <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="outline" />} />
                </DropdownMenu>
            </div>
        </div>
    );
};
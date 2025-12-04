const db = require('../../../conexiondb');


const rendercomercialMenu = (req, res) => {
    const menuItems = [
        { path: '/admin/comercial/', icon: 'bi-grid-1x2-fill', label: 'Dashboard' },
        
    ];
    res.render("admins/comercial", { user: req.session.user, menuItems: menuItems });
};





module.exports = {
rendercomercialMenu

};
/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
define(['N/url'], (url) => {
    const pageInit = (context) => { }

    /**
     * Generates and calls the URL for the SuiteLet passing Order and Fulfillment IDs
     *
     * @param {Number} soId
     * @param {Number} ifId
     */
    const printCommercialInvoice = (soId, ifId) => {
        let restletUrl = url.resolveScript({
            deploymentId: 'customdeploy_nse_pci_sl_render_pdf',
            scriptId: 'customscript_nse_pci_sl_render_pdf',
            params: {
                orderId: soId,
                fulfillId: ifId
            }
        });

        window.open(restletUrl, '_blank');
    }

    return {
        pageInit,
        printCommercialInvoice
    };
}); 

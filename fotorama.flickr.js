/** 
 * Fotorama.Flickr 
 *
 * Displays a flickr photoset in a fotorama.io slideshow.
 * See http://fotorama.io for slideshow details.
 *
 * To Use: Just grab the normal flickr embed code, and change the script 
 * src to fotorama.flickr.js. You can also add data-options for fotorama.
 *
 * @author    Daniel Evisizor [daniel.evilsizors.com]
 * @requires  Fotorama, jQuery 1.8+, a flickr API key
 * @version   2016-10-22
 */


;(function(){

    // ---------  CONFIGURATION -----------
    
    // udpate these if you have fotorama installed locally
    var FOTORAMA_JS_URL  = 'http://cdnjs.cloudflare.com/ajax/libs/fotorama/4.6.4/fotorama.js';
    var FOTORAMA_CSS_URL = 'http://cdnjs.cloudflare.com/ajax/libs/fotorama/4.6.4/fotorama.css';
    var FLICKR_API_KEY   = '2f0e634b471fdb47446abcb9c5afebdc';
    
    // ---------  end CONFIGURATION -----------

    
    var flickrApiUrl = 'https://api.flickr.com/services/rest/';
    var flickrSizes = ['url_l', 'url_c', 'url_z' , 'url_o'];       // try to use these sizes, in order.
    
    function _warn(msg) {
        try {
            console.warn(Plugin.name + ': ' + msg);
        } catch(e){}
    }
    
    var Plugin = {
        name:  'Fotorama.Flickr',
        defaults: {
            plugin: {
                'captions':             'true',
                'number':               'all'       // how many photos to display. 'all' or integer number of photos
            },
            fotorama: {
                'nav':                  'thumbs',   // dots | thumbs | false
                'allowfullscreen':      'false',    // false | true | native
                'fit':                  null,       // contain | cover | scaledown | none
                'transition':           'slide',    // slide | dissolve | crossfade
                'autoplay':             'false',    // true or any interval in milliseconds.
                'loop':                 'false', 
                'keyboard':             'false', 
                'arrows':               'always',   // false | true | always
                'width':                '100%',     // pixel or percent value
                'height':               null,       // pixel or percent value
                'ratio':                null        // see fotorama documentation
            }
        }
    };
    
    
    Plugin.init = function()
    {
        // ensure script only runs once
        if (Plugin.name+'.loaded' in window) {
            return false;
        }
        
        // set flag
        window[Plugin.name+'.loaded'] = true;
        
        this.LoadCSS();
        
        this._jqueryChecks = 0;
        this.CheckJQuery();
    }
    
    
    Plugin.LoadCSS = function()
    {
        var stylesheet = document.createElement( "link" );
        stylesheet.href = FOTORAMA_CSS_URL;
        stylesheet.type = "text/css";
        stylesheet.rel = "stylesheet";

        document.getElementsByTagName('head')[0].appendChild( stylesheet );
    }

    
    Plugin.LoadFotorama = function()
    {
        // load fotorama JS
        var script = document.createElement('script');
        script.src = FOTORAMA_JS_URL;
        document.getElementsByTagName('head')[0].appendChild(script);
    }
    
    /**
     * Check if jQuery is loaded yet. If not, wait before continuing.
     * Allows you to drop this script in the middle of a page, even
     * if jQuery is defined in the footer.
     */
    Plugin.CheckJQuery = function()
    {
        if (this._jqueryChecks > 50) {
            _warn('Gave up waiting for jQuery, aborting.');
            return false;
        }
        
        this._jqueryChecks++;
        
        if ('jQuery' in window) {
            Plugin.onJQueryReady();
        }
        else {
            window.setTimeout( Plugin.CheckJQuery, 200 );
        }
    }


    Plugin.onJQueryReady = function()
    {
        this.LoadFotorama();
        
        // Find slideshow elements
        $('a[data-flickr-embed="true"]').each(function(i) {
            window['slideshow'+i] = new Slideshow( this );
        });
    }
    
    var Slideshow = function(el)
    {
        var me = this;
        this.el = el;
        
        var albumId = el.href.substring( 1 + el.href.lastIndexOf('/') );
        var randID = Math.floor((1 + Math.random()) * 10000).toString();
        
        var jsonpMethod = 'jsonp_'+randID;
        
        window[jsonpMethod] = function(rsp) { me.ProcessResponse(rsp); }
        
        var url = flickrApiUrl + "?method=flickr.photosets.getPhotos&api_key=" + FLICKR_API_KEY + "&photoset_id="+albumId+"&extras=description,views,license,icon_server,url_o,url_sq,url_t,url_q,url_s,url_m,url_l,url_z,url_b,url_h,url_k&format=json&jsoncallback="+jsonpMethod;
        
        var script = document.createElement('script');
        script.src = url;

        document.getElementsByTagName('head')[0].appendChild(script);
    }
    
    
    Slideshow.prototype.GetOptions = function(defaults)
    {
        var opts = $.extend( {}, defaults );
        
        for (var o in defaults) {
            var attr = this.el.getAttribute('data-'+ o);
            if (attr) {
                opts[ o ] = attr;
            }
        }
        
        return opts;
    }
    
    Slideshow.prototype.ProcessResponse = function(rsp)
    {
        if (rsp.stat != "ok") {
            _warn('Error retrieving photoset');
            return;
        }

        var fotorama_opts = this.GetOptions( Plugin.defaults.fotorama);
        var plugin_opts = this.GetOptions(Plugin.defaults.plugin);
        
        var opts_html = '';
        for (var o in fotorama_opts) {
            if (fotorama_opts[o] != null) {
                opts_html += 'data-' + o + '="' + fotorama_opts[o] + '" ';
            }
        }
        
        var photosHtml = this.ParsePhotos(rsp, plugin_opts, fotorama_opts);
        
        if (photosHtml) {
            var html = '<div class="fotorama" ' + opts_html + '>';
            html += photosHtml;
            html += '</div>';
            
            var $slideshow = $(html);
            this.$slideshow = $slideshow;
            
            $(this.el).replaceWith( $slideshow );
            
            this.ActivateFotorama();
        }
    }
    
    /**
     * Initialize fotorama on the slideshow element.
     * Delay is sometimes needed because, in testing, sometimes the fotorama() plugin
     * is not yet ready.
     */
    Slideshow.prototype.ActivateFotorama = function()
    {
        if (jQuery.fn.fotorama) {
            this.$slideshow.fotorama();
        }
        else {
            window.setTimeout( this.ActivateFotorama, 200 );
        }
    }


    Slideshow.prototype.ParsePhotos = function(rsp, plugin_opts, fotorama_opts)
    {
        var photoset = rsp.photoset;
        
        var html = '';
        
        var max = photoset.photo.length;
        if (plugin_opts['number'] != 'all' && Number(plugin_opts['number']) < max) {
            max = Number(plugin_opts['number']);
        }
        
        for (var i=0; i< max; i++) {

            var photo = photoset.photo[i];
            var title = photo.title;
            var desc = photo.description._content;
            var thumb_url = photo.url_sq;
            
            for (var s in flickrSizes) {
                if (  flickrSizes[s] in photo) {
                    var img_url = photo[ flickrSizes[s] ];
                }
            }
            
            if (typeof img_url == 'undefined') {
                _warn('Unable to find size for image');
                continue;
            }
            
            if (plugin_opts.captions == 'true' && desc != '') {
                desc = desc.replace(/[\n\r]/g, ' ');
                if (desc.length > 150) {
                    desc = desc.substring(0, 150) + '&hellip;'
                }
                
                var caption = (title) ? ('<b>'+title+'</b><br/>'+desc) : desc;
                var html_caption = 'data-caption="'+caption+'"';
            }
            else html_caption = '';

            if (fotorama_opts['nav'] == 'thumbs') {
                // use small square image for thumbnail
                html += '<a '+html_caption+' href="' + img_url + '"><img src="'+thumb_url+'"  /></a>';
            }
            else {
                html += '<img src="'+img_url+'" '+html_caption+' />';
            }
        }
        
        return html;
    }
    
    

    
    Plugin.init();
    
})();


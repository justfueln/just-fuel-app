import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state={hasError:false};
  }

  static getDerivedStateFromError(){
    return {hasError:true};
  }

  componentDidCatch(error,info){
    console.error('Just Fuel app error',error,info);
  }

  render(){
    if(this.state.hasError){
      return <div className="jf-error-screen" role="alert">
        <div className="jf-error-card">
          <div className="jf-error-mark">JF</div>
          <h1>Something went wrong</h1>
          <p>Your data has not been deleted. Reload the app and try again.</p>
          <button onClick={()=>window.location.reload()}>Reload app</button>
        </div>
      </div>;
    }
    return this.props.children;
  }
}
